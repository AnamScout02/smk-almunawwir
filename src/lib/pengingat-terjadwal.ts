import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { filterSiswaPeserta } from "@/lib/ujian-server";
import { kirimNotifikasi, type IsiNotifikasi } from "@/lib/push-server";
import { hitungRisikoSiswa, userKesiswaanBk } from "@/lib/peringatan-dini";
import { pengingatPerpustakaan } from "@/lib/notifikasi-perpustakaan";
import { cekLibur, perbaruiLiburNasional } from "@/lib/hari-libur";
import { pengingatSpmb } from "@/lib/pengingat-spmb";
import { pengingatPkl } from "@/lib/pengingat-pkl";

/** PENGINGAT TERJADWAL — dijalankan src/instrumentation.ts tiap 5 menit. Jam pengingat diatur admin di
 * Notifikasi Push (SiteSetting `notifikasi.*`). Sebuah jam "jatuh tempo" selama 60 menit sejak jam itu;
 * karena setiap pengiriman berkunci (tanggal + jam + sasaran), pengecekan berulang tidak mengirim dobel,
 * dan server yang sempat mati beberapa menit tetap mengejar pengingatnya.
 *
 * Mode PRATINJAU (`opsi.kirim` diganti pengumpul, `opsi.kering`): menghitung apa yang AKAN dikirim pada waktu
 * tertentu tanpa mengirim apa pun — dipakai halaman admin & uji otomatis.
 *
 * Tanggal di tabel Attendance / TeachingJournal / TeacherScheduleAttendance disimpan sebagai tengah malam
 * UTC dari "YYYY-MM-DD" hari WIB → rentang hari dihitung dari tanggal WIB dengan jam 00:00Z. */

export const PENGATURAN_NOTIFIKASI = {
  aktif: "notifikasi.aktif",
  jamAbsensi: "notifikasi.jamAbsensi",
  jamPiket: "notifikasi.jamPiket",
  jamJurnal: "notifikasi.jamJurnal",
  tanggalLibur: "notifikasi.tanggalLibur",
  liburNasional: "notifikasi.liburNasional",
  jamPeringatanDini: "notifikasi.jamPeringatanDini",
  jamPerpustakaan: "notifikasi.jamPerpustakaan",
  jamRekapKelas: "notifikasi.jamRekapKelas",
  jamRingkasanOrtu: "notifikasi.jamRingkasanOrtu",
  jamSpmb: "notifikasi.jamSpmb",
  jamPkl: "notifikasi.jamPkl",
} as const;

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const JENDELA_MENIT = 60;

type Pengirim = (n: IsiNotifikasi) => Promise<unknown>;
export type OpsiPengingat = { kirim?: Pengirim; kering?: boolean };
export type WaktuWib = { tanggal: string; menit: number; hari: string; awalHari: Date; akhirHari: Date };

export function waktuWib(now: Date): WaktuWib {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const tanggal = wib.toISOString().slice(0, 10);
  const awalHari = new Date(`${tanggal}T00:00:00.000Z`);
  return {
    tanggal, awalHari, akhirHari: new Date(awalHari.getTime() + 86400_000),
    menit: wib.getUTCHours() * 60 + wib.getUTCMinutes(),
    hari: HARI[wib.getUTCDay()],
  };
}

const menitDari = (jam: string) => {
  const [h, m] = jam.split(/[:.]/).map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : NaN;
};

/** "07:30,09:30" → jam yang sudah lewat tapi masih di dalam jendela 60 menit, mis. ["0730"]. */
export function slotJatuhTempo(daftar: string | undefined, menit: number): string[] {
  return (daftar ?? "").split(/[\s,;]+/).filter(Boolean)
    .filter(j => { const t = menitDari(j); return Number.isFinite(t) && menit >= t && menit < t + JENDELA_MENIT; })
    .map(j => j.replace(/[:.]/, ""));
}

const tanggalPanjang = (w: WaktuWib) =>
  w.awalHari.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function jalankanPengingat(now = new Date(), opsi: OpsiPengingat = {}) {
  const kirim: Pengirim = opsi.kirim ?? kirimNotifikasi;
  // Mode normal: satu pengingat yang gagal tidak menghentikan yang lain. Mode pratinjau: galat ditampilkan.
  const jalan = async (f: () => Promise<void>) => { try { await f(); } catch (e) { if (opsi.kering) throw e; } };

  const s = await getSettings(Object.values(PENGATURAN_NOTIFIKASI));
  if (!opsi.kering && s[PENGATURAN_NOTIFIKASI.aktif] === "0") return;
  const w = waktuWib(now);

  await jalan(() => pengingatUjianDimulai(now, kirim));

  // Hari libur = Minggu + agenda Libur Kalender Pendidikan + tanggal merah nasional + libur tambahan (src/lib/hari-libur.ts).
  if (!opsi.kering) await jalan(async () => { await perbaruiLiburNasional(); });
  if (await cekLibur(w.tanggal)) return;
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamAbsensi], w.menit)) await jalan(() => pengingatAbsensi(w, slot, kirim));
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamPiket], w.menit)) await jalan(() => pengingatPiket(w, slot, kirim));
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamJurnal], w.menit)) await jalan(() => pengingatJurnal(w, slot, kirim));
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamPerpustakaan], w.menit)) { void slot; await jalan(() => pengingatPerpustakaan(w.tanggal, kirim)); }
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamRekapKelas], w.menit)) await jalan(() => rekapHarianKelas(w, slot, kirim));
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamSpmb], w.menit)) { void slot; await jalan(() => pengingatSpmb(w, { kirim, kering: opsi.kering })); }
  for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamPkl], w.menit)) { void slot; await jalan(() => pengingatPkl(w, { kirim })); }
  if (w.hari === "SABTU") {
    for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamRingkasanOrtu], w.menit)) await jalan(() => ringkasanMingguanOrtu(w, slot, kirim));
  }
  if (w.hari === "SENIN") {
    for (const slot of slotJatuhTempo(s[PENGATURAN_NOTIFIKASI.jamPeringatanDini], w.menit)) await jalan(() => ringkasanPeringatanDini(w, slot, now, kirim));
  }
}

/** RINGKASAN MINGGUAN KE ORANG TUA (17 Sep 2026) — tiap Sabtu: kehadiran anak pekan ini, poin pelanggaran/prestasi,
 * dan jumlah nilai baru. Satu notifikasi per anak; kunci per pekan supaya tidak dobel. */
async function ringkasanMingguanOrtu(w: WaktuWib, slot: string, kirim: Pengirim) {
  const awalPekan = new Date(w.awalHari.getTime() - 5 * 86400_000); // Senin (Sabtu − 5 hari)
  const anak = await prisma.parentStudent.findMany({
    where: { student: { studentStatus: "AKTIF" } },
    select: {
      parent: { select: { userId: true } },
      student: {
        select: {
          id: true, user: { select: { name: true } },
          attendance: { where: { date: { gte: awalPekan, lt: w.akhirHari } }, select: { status: true } },
          pointRecords: { where: { date: { gte: awalPekan } }, select: { kind: true, points: true } },
          grades: { where: { createdAt: { gte: awalPekan } }, select: { id: true } },
        },
      },
    },
  });
  const perOrtu = new Map<string, string[]>();
  for (const a of anak) {
    const h = a.student.attendance;
    const n = (st: string) => h.filter(x => x.status === st).length;
    const pelanggaran = a.student.pointRecords.filter(p => p.kind === "PELANGGARAN").reduce((x, y) => x + y.points, 0);
    const prestasi = a.student.pointRecords.filter(p => p.kind === "PRESTASI").reduce((x, y) => x + y.points, 0);
    if (!h.length && !pelanggaran && !prestasi && !a.student.grades.length) continue;
    const bagian = [
      h.length ? `hadir ${n("HADIR")}${n("IZIN") ? `, izin ${n("IZIN")}` : ""}${n("SAKIT") ? `, sakit ${n("SAKIT")}` : ""}${n("ALPHA") ? `, alpha ${n("ALPHA")}` : ""}` : "",
      a.student.grades.length ? `${a.student.grades.length} nilai baru` : "",
      pelanggaran ? `poin pelanggaran +${pelanggaran}` : "",
      prestasi ? `poin prestasi +${prestasi}` : "",
    ].filter(Boolean).join(" · ");
    perOrtu.set(a.parent.userId, [...(perOrtu.get(a.parent.userId) ?? []), `${a.student.user.name}: ${bagian}`]);
  }
  for (const [userId, baris] of perOrtu) {
    await kirim({
      userIds: [userId], jenis: "REKAP_HARIAN_KELAS", kunci: `ringkasan-ortu:${userId}:${w.tanggal}:${slot}`,
      judul: "Ringkasan pekan ini", isi: baris.slice(0, 3).join("\n"), url: "/dashboard/parent", tag: "ringkasan-ortu",
    });
  }
}

/** Rekap kehadiran harian ke WALI KELAS (17 Sep 2026 — permintaan user: "rekap harian singkat ke wali kelas lewat notifikasi").
 * Hanya kelas yang absensinya sudah mulai diisi hari ini (kelas yang belum diisi sudah diurus pengingatAbsensi). Menyebut nama
 * siswa alpha (maks 5) dan jumlah pengajuan izin orang tua yang menunggu keputusan. */
async function rekapHarianKelas(w: WaktuWib, slot: string, kirim: Pengirim) {
  const kelas = await prisma.class.findMany({
    where: { homeroomId: { not: null }, students: { some: { studentStatus: "AKTIF" } } },
    select: {
      id: true, name: true, homeroom: { select: { userId: true } },
      students: {
        where: { studentStatus: "AKTIF" },
        select: {
          user: { select: { name: true } },
          attendance: { where: { date: { gte: w.awalHari, lt: w.akhirHari } }, select: { status: true }, take: 1 },
          izinSiswa: { where: { status: "MENUNGGU" }, select: { id: true } },
        },
      },
    },
  });
  for (const k of kelas) {
    if (!k.homeroom?.userId) continue;
    const tercatat = k.students.filter(s => s.attendance.length);
    if (!tercatat.length) continue;
    const n = (st: string) => tercatat.filter(s => s.attendance[0].status === st).length;
    const alpha = tercatat.filter(s => s.attendance[0].status === "ALPHA").map(s => s.user.name.split(" ").slice(0, 2).join(" "));
    const belum = k.students.length - tercatat.length;
    const izinMenunggu = k.students.reduce((a, s) => a + s.izinSiswa.length, 0);
    const bagian = [
      `Hadir ${n("HADIR")} · Izin ${n("IZIN")} · Sakit ${n("SAKIT")} · Alpha ${n("ALPHA")}${belum ? ` · belum dicatat ${belum}` : ""}.`,
      alpha.length ? `Alpha: ${alpha.slice(0, 5).join(", ")}${alpha.length > 5 ? ` +${alpha.length - 5}` : ""}.` : "",
      izinMenunggu ? `${izinMenunggu} pengajuan izin orang tua menunggu keputusan.` : "",
    ].filter(Boolean);
    await kirim({
      userIds: [k.homeroom.userId], jenis: "REKAP_HARIAN_KELAS", gantiHariIni: true,
      kunci: `rekap-kelas:${w.tanggal}:${slot}:${k.id}`,
      judul: `Rekap kehadiran ${k.name} hari ini`,
      isi: bagian.join(" "),
      url: izinMenunggu ? "/dashboard/teacher/izin-siswa" : `/dashboard/teacher/attendance/${k.id}`, tag: `rekap-kelas-${k.id}`,
    });
  }
}

/** Siswa kelas peserta diberi tahu saat ujian yang sudah diterbitkan mulai (±15 menit pertama). */
async function pengingatUjianDimulai(now: Date, kirim: Pengirim) {
  const ujian = await prisma.exam.findMany({
    where: { isPublished: true, startTime: { lte: now, gte: new Date(now.getTime() - 15 * 60_000) }, endTime: { gt: now } },
    select: { id: true, title: true, subject: true, classId: true, kelasIds: true, pesertaIds: true, endTime: true },
  });
  for (const e of ujian) {
    const siswa = await prisma.student.findMany({ where: filterSiswaPeserta(e), select: { userId: true } });
    const sampai = e.endTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    await kirim({
      userIds: siswa.map(x => x.userId), jenis: "UJIAN_MULAI", kunci: `ujian-mulai:${e.id}`,
      judul: `Ujian dimulai: ${e.subject}`,
      isi: `${e.title} sudah bisa dikerjakan sampai pukul ${sampai} WIB. Buka Ujian Online dan masukkan token dari pengawas.`,
      url: "/ujian-online", tag: `ujian-${e.id}`,
    });
  }
}

/** Absensi kelas belum diisi → ketua & sekretaris kelas, dan wali kelas. Hanya kelas yang punya jadwal hari ini. */
async function pengingatAbsensi(w: WaktuWib, slot: string, kirim: Pengirim) {
  const minggu = await getWeekTypeForDate(w.awalHari);
  const kelas = await prisma.class.findMany({
    where: { students: { some: { studentStatus: "AKTIF" } }, schedules: { some: { day: w.hari, scheduleType: "BLOK" } } },
    select: {
      id: true, name: true,
      ketuaKelas: { select: { userId: true } }, sekretaris: { select: { userId: true } }, homeroom: { select: { userId: true } },
      schedules: { where: { day: w.hari, scheduleType: "BLOK" }, select: { weekType: true } },
    },
  });
  const hariIni = kelas.filter(k => k.schedules.some(j => weekTypesOverlap(j.weekType, minggu)));
  if (!hariIni.length) return;
  const terisi = await prisma.attendance.findMany({
    where: { date: { gte: w.awalHari, lt: w.akhirHari }, student: { classId: { in: hariIni.map(k => k.id) } } },
    select: { student: { select: { classId: true } } },
  });
  const sudah = new Set(terisi.map(t => t.student.classId));
  for (const k of hariIni) {
    if (sudah.has(k.id)) continue;
    const pengurus = [k.ketuaKelas?.userId, k.sekretaris?.userId].filter((x): x is string => !!x);
    if (pengurus.length) {
      await kirim({
        userIds: pengurus, jenis: "ABSENSI_BELUM", gantiHariIni: true, kunci: `absensi-belum:${w.tanggal}:${slot}:${k.id}:pengurus`,
        judul: `Absensi ${k.name} belum diisi`,
        isi: `Absensi kelas ${tanggalPanjang(w)} belum diisi. Isi sekarang lewat menu Absensi Kelas.`,
        url: "/dashboard/student/absensi-kelas", tag: `absensi-${k.id}`,
      });
    }
    if (k.homeroom?.userId) {
      await kirim({
        userIds: [k.homeroom.userId], jenis: "ABSENSI_BELUM", gantiHariIni: true, kunci: `absensi-belum:${w.tanggal}:${slot}:${k.id}:wali`,
        judul: `Absensi ${k.name} belum diisi`,
        isi: `Absensi ${tanggalPanjang(w)} belum diisi oleh wali kelas maupun ketua/sekretaris kelas.`,
        url: `/dashboard/teacher/attendance/${k.id}`, tag: `absensi-${k.id}`,
      });
    }
  }
}

/** Petugas piket hari ini belum mengisi kehadiran guru untuk jam pelajaran yang sudah berjalan (kelas X & XI,
 * jadwal BLOK — sama dengan cakupan Buku Piket di modul Kedisiplinan). */
async function pengingatPiket(w: WaktuWib, slot: string, kirim: Pengirim) {
  const minggu = await getWeekTypeForDate(w.awalHari);
  const roster = await prisma.dutyRoster.findMany({ where: { day: w.hari }, select: { userId: true, weekType: true } });
  const petugas = [...new Set(roster.filter(r => weekTypesOverlap(r.weekType, minggu)).map(r => r.userId))];
  if (!petugas.length) return;
  const jadwal = await prisma.schedule.findMany({
    where: { day: w.hari, scheduleType: "BLOK", teacherId: { not: null }, class: { grade: { in: [10, 11] } } },
    select: { id: true, startTime: true, weekType: true },
  });
  const berjalan = jadwal.filter(j => weekTypesOverlap(j.weekType, minggu) && menitDari(j.startTime) <= w.menit);
  if (!berjalan.length) return;
  const terisi = await prisma.teacherScheduleAttendance.count({
    where: { scheduleId: { in: berjalan.map(j => j.id) }, date: { gte: w.awalHari, lt: w.akhirHari } },
  });
  const belum = berjalan.length - terisi;
  if (belum <= 0) return;
  const pengguna = await prisma.user.findMany({ where: { id: { in: petugas } }, select: { id: true, role: true } });
  const guru = pengguna.filter(u => u.role === "TEACHER").map(u => u.id);
  const staf = pengguna.filter(u => u.role !== "TEACHER").map(u => u.id);
  const isi = `${belum} dari ${berjalan.length} jam pelajaran yang sudah berjalan hari ini belum diisi kehadiran gurunya di Buku Piket.`;
  if (guru.length) await kirim({ userIds: guru, jenis: "PIKET_BELUM", gantiHariIni: true, kunci: `piket-belum:${w.tanggal}:${slot}:guru`, judul: "Buku piket belum lengkap", isi, url: "/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan", tag: "piket" });
  if (staf.length) await kirim({ userIds: staf, jenis: "PIKET_BELUM", gantiHariIni: true, kunci: `piket-belum:${w.tanggal}:${slot}:staf`, judul: "Buku piket belum lengkap", isi, url: "/dashboard/admin/kedisiplinan-guru", tag: "piket" });
}

/** Guru yang mengajar hari ini tetapi belum mengisi jurnal untuk kelas itu. Dicocokkan per guru + kelas
 * (bukan nama mapel) supaya perbedaan penulisan mapel tidak memicu pengingat keliru. */
async function pengingatJurnal(w: WaktuWib, slot: string, kirim: Pengirim) {
  const minggu = await getWeekTypeForDate(w.awalHari);
  const jadwal = await prisma.schedule.findMany({
    where: { day: w.hari, scheduleType: "BLOK", teacherId: { not: null } },
    select: { teacherId: true, classId: true, weekType: true, class: { select: { name: true } }, teacher: { select: { userId: true } } },
  });
  const perGuru = new Map<string, { userId: string; kelas: Map<string, string> }>();
  for (const j of jadwal) {
    if (!j.teacherId || !j.teacher || !weekTypesOverlap(j.weekType, minggu)) continue;
    const g = perGuru.get(j.teacherId) ?? { userId: j.teacher.userId, kelas: new Map<string, string>() };
    g.kelas.set(j.classId, j.class.name);
    perGuru.set(j.teacherId, g);
  }
  if (!perGuru.size) return;
  const jurnal = await prisma.teachingJournal.findMany({
    where: { date: { gte: w.awalHari, lt: w.akhirHari }, teacherId: { in: [...perGuru.keys()] } },
    select: { teacherId: true, classId: true },
  });
  const ada = new Set(jurnal.map(j => `${j.teacherId}|${j.classId}`));
  for (const [teacherId, g] of perGuru) {
    const belum = [...g.kelas].filter(([classId]) => !ada.has(`${teacherId}|${classId}`)).map(([, nama]) => nama);
    if (!belum.length) continue;
    const daftar = belum.slice(0, 3).join(", ") + (belum.length > 3 ? ` dan ${belum.length - 3} kelas lain` : "");
    await kirim({
      userIds: [g.userId], jenis: "JURNAL_BELUM", gantiHariIni: true, kunci: `jurnal-belum:${w.tanggal}:${slot}:${teacherId}`,
      judul: "Jurnal mengajar belum diisi",
      isi: `Jurnal ${tanggalPanjang(w)} belum diisi untuk: ${daftar}.`,
      url: "/dashboard/teacher/journal", tag: "jurnal",
    });
  }
}

/** Ringkasan mingguan (Senin) peringatan dini: wali kelas → siswa kelasnya yang berisiko tinggi/sedang;
 * Guru BK & Wakasek Kesiswaan → rekap seluruh sekolah. Hanya dikirim bila ada siswa berisiko tinggi/sedang. */
async function ringkasanPeringatanDini(w: WaktuWib, slot: string, now: Date, kirim: Pengirim) {
  const [risiko, kelas, bk] = await Promise.all([
    hitungRisikoSiswa({ now }),
    prisma.class.findMany({ select: { id: true, name: true, homeroom: { select: { userId: true } } } }),
    userKesiswaanBk(),
  ]);
  const serius = risiko.baris.filter(b => b.tingkat !== "PANTAU");
  if (!serius.length) return;
  const perWali = new Map<string, { tinggi: number; sedang: number; kelas: Set<string> }>();
  for (const k of kelas) {
    const wali = k.homeroom?.userId;
    if (!wali) continue;
    const baris = serius.filter(b => b.classId === k.id);
    if (!baris.length) continue;
    const r = perWali.get(wali) ?? { tinggi: 0, sedang: 0, kelas: new Set<string>() };
    r.tinggi += baris.filter(b => b.tingkat === "TINGGI").length;
    r.sedang += baris.filter(b => b.tingkat === "SEDANG").length;
    r.kelas.add(k.name);
    perWali.set(wali, r);
  }
  for (const [userId, r] of perWali) {
    await kirim({
      userIds: [userId], jenis: "PERINGATAN_DINI", gantiHariIni: true, kunci: `peringatan-dini:${w.tanggal}:${slot}:${userId}`,
      judul: "Peringatan dini minggu ini",
      isi: `${r.tinggi + r.sedang} siswa ${[...r.kelas].join(", ")} perlu perhatian (${r.tinggi} risiko tinggi, ${r.sedang} sedang).`,
      url: "/dashboard/teacher/peringatan-dini", tag: "peringatan-dini",
    });
  }
  if (bk.length) {
    await kirim({
      userIds: bk, jenis: "PERINGATAN_DINI", gantiHariIni: true, kunci: `peringatan-dini:${w.tanggal}:${slot}:bk`,
      judul: "Peringatan dini minggu ini",
      isi: `Seluruh sekolah: ${risiko.ringkas.tinggi} siswa risiko tinggi, ${risiko.ringkas.sedang} sedang, ${risiko.ringkas.pantau} perlu dipantau.`,
      url: "/dashboard/teacher/peringatan-dini", tag: "peringatan-dini",
    });
  }
}
