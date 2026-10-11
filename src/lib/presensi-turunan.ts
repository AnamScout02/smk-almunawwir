import "server-only";
import { prisma } from "@/lib/prisma";
import { daftarLibur } from "@/lib/hari-libur";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";

/** PRESENSI TURUNAN & JAM PULANG PERKIRAAN (10 Oktober 2026, keputusan user: "gas" atas butir 1–3).
 *
 * Temuan data sebulan (10 Sep–10 Okt): 99 hari-guru tercatat MASUK KELAS tetapi Presensi Pegawai-nya kosong, dan 62 dari
 * 63 pindaian tidak punya jam pulang. Catatannya bolong, bukan salah — jadi lubangnya diisi dari bukti yang sudah ada,
 * dengan ASAL yang selalu tertulis (`StaffAttendance.sumber`):
 *
 *   TU        diisi Tata Usaha                         ← paling berkuasa, tidak pernah ditimpa
 *   QR/KARTU/KEGIATAN  pindaian orangnya sendiri
 *   PIKET     TURUNAN: guru piket mencatat HADIR/TERLAMBAT di jam pelajarannya
 *   JURNAL    TURUNAN: guru mengisi Jurnal Mengajar PADA HARI ITU JUGA (bukti dari orangnya sendiri → paling lemah)
 *
 * Aturan yang dijaga:
 *   - Turunan HANYA mengisi hari yang BELUM punya catatan (aturan #33/#52). Satu-satunya "naik kelas" yang boleh:
 *     JURNAL → PIKET, karena catatan piket lebih kuat daripada pengakuan sendiri.
 *   - Jurnal yang diisi SUSULAN (dibuat di hari lain) TIDAK dijadikan bukti hadir — guru bisa melengkapi jurnal hari
 *     ketika ia tidak masuk; itu sah sebagai jurnal, tetapi bukan bukti kehadiran.
 *   - Turunan tidak pernah mengarang JAM MASUK. Jam pulang perkiraan = akhir jam mengajar terakhir hari itu, hanya untuk
 *     baris yang SUDAH punya jam masuk, dan ditandai `pulangPerkiraan` supaya tidak terbaca sebagai pindaian.
 *   - Hari libur dilewati. */

export { SUMBER_TURUNAN, LABEL_SUMBER } from "@/lib/presensi-sumber";
const KET: Record<string, string> = {
  PIKET: "Turunan: guru piket mencatat masuk kelas",
  JURNAL: "Turunan: mengisi jurnal mengajar di hari yang sama",
};
const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isoWib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export async function turunkanPresensi(dari: string, sampai: string): Promise<{ dibuat: number; dinaikkan: number; dicabut: number }> {
  const awal = new Date(`${dari}T00:00:00Z`), akhir = new Date(new Date(`${sampai}T00:00:00Z`).getTime() + 86400000);
  const [libur, piket, jurnal, ada] = await Promise.all([
    daftarLibur(dari, sampai).then(l => new Set(l.map(x => x.tanggal))),
    prisma.teacherScheduleAttendance.findMany({
      where: { date: { gte: awal, lt: akhir }, status: { in: ["HADIR", "TERLAMBAT"] } },
      select: { date: true, schedule: { select: { teacher: { select: { userId: true, teacherStatus: true } } } } },
    }),
    prisma.teachingJournal.findMany({
      where: { date: { gte: awal, lt: akhir } },
      select: { date: true, createdAt: true, teacher: { select: { userId: true, teacherStatus: true } } },
    }),
    prisma.staffAttendance.findMany({ where: { tanggal: { gte: awal, lt: akhir } }, select: { id: true, userId: true, tanggal: true, sumber: true, jamMasuk: true, recordedById: true } }),
  ]);
  const aktif = (t?: { teacherStatus: string | null } | null) => !!t && (!t.teacherStatus || t.teacherStatus === "AKTIF");
  const bukti = new Map<string, "PIKET" | "JURNAL">();
  for (const j of jurnal) {
    if (!aktif(j.teacher) || isoWib(j.createdAt) !== iso(j.date)) continue;
    bukti.set(`${j.teacher.userId}|${iso(j.date)}`, "JURNAL");
  }
  for (const p of piket) {
    const t = p.schedule.teacher;
    if (aktif(t)) bukti.set(`${t!.userId}|${iso(p.date)}`, "PIKET");
  }
  const petaAda = new Map(ada.map(a => [`${a.userId}|${iso(a.tanggal)}`, a]));
  const baru: { userId: string; tanggal: Date; status: string; sumber: string; keterangan: string }[] = [];
  const naik: string[] = [];
  for (const [k, sumber] of bukti) {
    const [userId, tgl] = k.split("|");
    if (libur.has(tgl)) continue;
    const a = petaAda.get(k);
    if (!a) baru.push({ userId, tanggal: new Date(`${tgl}T00:00:00Z`), status: "HADIR", sumber, keterangan: KET[sumber] });
    else if (a.sumber === "JURNAL" && sumber === "PIKET") naik.push(a.id);
  }
  const dibuat = baru.length ? (await prisma.staffAttendance.createMany({ data: baru, skipDuplicates: true })).count : 0;
  if (naik.length) await prisma.staffAttendance.updateMany({ where: { id: { in: naik }, sumber: "JURNAL" }, data: { sumber: "PIKET", keterangan: KET.PIKET } });
  // Turunan yang BUKTINYA sudah tidak ada (jurnal dihapus, catatan piket dikoreksi) ikut dicabut — tanpa ini catatan hadir
  // tertinggal tanpa dasar (terbukti saat uji: jurnal uji dihapus, baris turunannya tetap ada). Hanya baris yang masih
  // murni turunan: belum dikuatkan pindaian (tanpa jam masuk) dan belum disentuh Tata Usaha.
  const yatim = ada.filter(a => (a.sumber === "PIKET" || a.sumber === "JURNAL") && !a.jamMasuk && !a.recordedById && !bukti.has(`${a.userId}|${iso(a.tanggal)}`)).map(a => a.id);
  const turun = ada.filter(a => a.sumber === "PIKET" && !a.jamMasuk && !a.recordedById && bukti.get(`${a.userId}|${iso(a.tanggal)}`) === "JURNAL").map(a => a.id);
  if (yatim.length) await prisma.staffAttendance.deleteMany({ where: { id: { in: yatim }, sumber: { in: ["PIKET", "JURNAL"] }, jamMasuk: null, recordedById: null } });
  if (turun.length) await prisma.staffAttendance.updateMany({ where: { id: { in: turun }, sumber: "PIKET" }, data: { sumber: "JURNAL", keterangan: KET.JURNAL } });
  return { dibuat, dinaikkan: naik.length, dicabut: yatim.length };
}

/** Jam pulang perkiraan untuk baris HADIR ber-jam-masuk tanpa jam pulang. Hari ini baru diisi setelah pukul 17.00 WIB. */
export async function isiPulangPerkiraan(dari: string, sampai: string): Promise<number> {
  const kini = new Date(Date.now() + 7 * 3600_000), hariIni = kini.toISOString().slice(0, 10), soreIni = kini.getUTCHours() >= 17;
  const awal = new Date(`${dari}T00:00:00Z`), akhir = new Date(new Date(`${sampai}T00:00:00Z`).getTime() + 86400000);
  const baris = await prisma.staffAttendance.findMany({
    // Hanya catatan PINDAIAN: itu yang disepakati (62 dari 63 pindaian tanpa jam pulang). Baris isian Tata Usaha tidak
    // dilengkapi sistem — jam di sana adalah isian petugas, dan kosongnya bisa disengaja.
    where: { tanggal: { gte: awal, lt: akhir }, status: "HADIR", jamMasuk: { not: null }, jamPulang: null, sumber: { in: ["QR", "KARTU", "KEGIATAN"] } },
    select: { id: true, userId: true, tanggal: true, jamMasuk: true },
  });
  const perlu = baris.filter(b => iso(b.tanggal) < hariIni || (iso(b.tanggal) === hariIni && soreIni));
  if (!perlu.length) return 0;
  const jadwal = await prisma.schedule.findMany({
    where: { scheduleType: "BLOK", teacher: { userId: { in: [...new Set(perlu.map(p => p.userId))] } } },
    select: { day: true, endTime: true, weekType: true, teacher: { select: { userId: true } } },
  });
  let n = 0;
  for (const b of perlu) {
    const hari = HARI[b.tanggal.getUTCDay()], minggu = await getWeekTypeForDate(b.tanggal);
    const akhirJam = jadwal
      .filter(s => s.teacher?.userId === b.userId && s.day === hari && weekTypesOverlap(s.weekType, minggu))
      .map(s => s.endTime).sort().pop();
    if (!akhirJam || akhirJam <= (b.jamMasuk ?? "")) continue;
    const r = await prisma.staffAttendance.updateMany({ where: { id: b.id, jamPulang: null }, data: { jamPulang: akhirJam, pulangPerkiraan: true } });
    n += r.count;
  }
  return n;
}

/** Dipanggil penjadwal (instrumentation.ts) — tiga hari terakhir, murah & idempoten. */
export async function jalankanPresensiTurunan() {
  const kini = Date.now() + 7 * 3600_000;
  const sampai = new Date(kini).toISOString().slice(0, 10), dari = new Date(kini - 2 * 86400000).toISOString().slice(0, 10);
  // Dokumen dulu (cuti/surat tugas), baru turunan — supaya hari cuti tidak sempat terisi "hadir" dari jurnal susulan.
  await sinkronPresensiDokumenBaku().catch(() => null);
  const t = await turunkanPresensi(dari, sampai);
  const p = await isiPulangPerkiraan(dari, sampai);
  return { ...t, pulang: p };
}

/** PRESENSI DARI DOKUMEN (10 Okt 2026, tautan data): cuti yang DISETUJUI dan Surat Tugas otomatis menjadi catatan
 *  Presensi Pegawai pada tiap hari sekolah dalam rentangnya — TU tidak lagi mengetik ulang, dan guru yang ditugaskan keluar
 *  tidak terbaca "belum tercatat". Asal `CUTI` / `SURAT_TUGAS`.
 *   - Hanya mengisi hari yang BELUM punya catatan, atau yang catatannya masih turunan murni (PIKET/JURNAL tanpa jam):
 *     keputusan tertulis lebih kuat daripada dugaan sistem. Catatan TU dan pindaian tidak pernah ditimpa.
 *   - Dokumen dibatalkan/diubah → baris berasal `CUTI`/`SURAT_TUGAS` yang tidak lagi tercakup dicabut (yang sudah
 *     disentuh TU menjadi berasal TU, jadi aman).
 *   - Cuti berjenis SAKIT dicatat SAKIT; jenis lain CUTI. Surat tugas = DINAS_LUAR untuk pegawai yang terhubung ke akun
 *     (pelaksana yang hanya diketik namanya tidak punya akun pasti — tidak ditebak).
 *   - Hari libur dilewati; rentang ke depan ikut diisi (maks 120 hari dari hari ini) supaya stasiun pindai langsung tahu. */
export async function sinkronPresensiDokumen(dari: string, sampai: string): Promise<{ dibuat: number; dicabut: number }> {
  const awal = new Date(`${dari}T00:00:00Z`), akhir = new Date(`${sampai}T00:00:00Z`);
  const [libur, cuti, tugas, ada] = await Promise.all([
    daftarLibur(dari, sampai).then(l => new Set(l.map(x => x.tanggal))),
    prisma.staffLeave.findMany({ where: { status: "DISETUJUI", startDate: { lte: akhir }, endDate: { gte: awal } }, select: { jenis: true, startDate: true, endDate: true, teacher: { select: { userId: true } } } }),
    prisma.suratTugasPegawai.findMany({
      where: { teacherId: { not: null }, suratTugas: { tanggalBerangkat: { lte: akhir }, tanggalKembali: { gte: awal } } },
      select: { teacher: { select: { userId: true } }, suratTugas: { select: { nomor: true, tanggalBerangkat: true, tanggalKembali: true } } },
    }),
    prisma.staffAttendance.findMany({ where: { tanggal: { gte: awal, lte: akhir } }, select: { id: true, userId: true, tanggal: true, sumber: true, jamMasuk: true, recordedById: true } }),
  ]);
  // Tanggal disimpan dengan jam beragam (formulir lama memakai waktu lokal) — yang dipakai tanggal WIB-nya.
  const tglWib = (d: Date) => isoWib(d);
  const mau = new Map<string, { status: string; sumber: string; keterangan: string }>();
  const tandai = (userId: string | undefined, a: Date, z: Date, isi: { status: string; sumber: string; keterangan: string }) => {
    if (!userId) return;
    const mulai = tglWib(a) < dari ? dari : tglWib(a), selesai = tglWib(z) > sampai ? sampai : tglWib(z);
    for (let t = Date.parse(`${mulai}T00:00:00Z`); t <= Date.parse(`${selesai}T00:00:00Z`); t += 86400000) {
      const tgl = new Date(t).toISOString().slice(0, 10);
      if (!libur.has(tgl) && !mau.has(`${userId}|${tgl}`)) mau.set(`${userId}|${tgl}`, isi);
    }
  };
  // Surat tugas didahulukan: orang yang cuti lalu ditugaskan pada hari yang sama berarti cutinya batal di hari itu.
  for (const t of tugas) tandai(t.teacher?.userId, t.suratTugas.tanggalBerangkat, t.suratTugas.tanggalKembali, { status: "DINAS_LUAR", sumber: "SURAT_TUGAS", keterangan: `Surat Tugas ${t.suratTugas.nomor}` });
  for (const c of cuti) tandai(c.teacher?.userId, c.startDate, c.endDate, c.jenis === "SAKIT" ? { status: "SAKIT", sumber: "CUTI", keterangan: "Cuti sakit disetujui" } : { status: "CUTI", sumber: "CUTI", keterangan: "Cuti disetujui" });

  const petaAda = new Map(ada.map(a => [`${a.userId}|${iso(a.tanggal)}`, a]));
  const murniTurunan = (a: (typeof ada)[number]) => (a.sumber === "PIKET" || a.sumber === "JURNAL") && !a.jamMasuk && !a.recordedById;
  let dibuat = 0;
  for (const [k, isi] of mau) {
    const [userId, tgl] = k.split("|"), a = petaAda.get(k);
    if (!a) { dibuat += (await prisma.staffAttendance.createMany({ data: [{ userId, tanggal: new Date(`${tgl}T00:00:00Z`), ...isi }], skipDuplicates: true })).count; continue; }
    if (murniTurunan(a) || ((a.sumber === "CUTI" || a.sumber === "SURAT_TUGAS") && a.sumber !== isi.sumber && !a.recordedById)) {
      await prisma.staffAttendance.updateMany({ where: { id: a.id, recordedById: null, jamMasuk: null }, data: isi }); dibuat += 1;
    }
  }
  const yatim = ada.filter(a => (a.sumber === "CUTI" || a.sumber === "SURAT_TUGAS") && !a.recordedById && !mau.has(`${a.userId}|${iso(a.tanggal)}`)).map(a => a.id);
  if (yatim.length) await prisma.staffAttendance.deleteMany({ where: { id: { in: yatim }, sumber: { in: ["CUTI", "SURAT_TUGAS"] }, recordedById: null } });
  return { dibuat, dicabut: yatim.length };
}

/** Jendela baku: 30 hari ke belakang sampai 120 hari ke depan. Dipanggil setelah cuti/surat tugas disimpan & oleh penjadwal. */
export async function sinkronPresensiDokumenBaku() {
  const kini = Date.now() + 7 * 3600_000, h = (n: number) => new Date(kini + n * 86400000).toISOString().slice(0, 10);
  return sinkronPresensiDokumen(h(-30), h(120));
}
