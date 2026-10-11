import "server-only";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { semesterAktif } from "@/lib/kelengkapan-perangkat";
import { pekanEfektifKe, rentangSemesterTA } from "@/lib/pekan-efektif";
import { bacaButir, kemajuanRencana } from "@/lib/cocok-materi";
import { cekLibur } from "@/lib/hari-libur";

/** JURNAL SEKALI KETUK (10 Oktober 2026, pilihan user). Satu sumber untuk kartu di dashboard guru, halaman Jurnal, dan
 *  bot Telegram: jadwal guru pada satu tanggal + saran materi + penyimpan ringkas.
 *
 *  SARAN MATERI — berurutan, tidak pernah dikarang:
 *   1. butir Prota/Promes BERIKUTNYA yang belum tercatat di jurnal kelas itu (bukan butir "pekan ini": guru yang
 *      tertinggal mengajar butir berikutnya, bukan melompat);
 *   2. tanpa Prota/Promes → materi jurnal terakhir kelas itu, sebagai "lanjutan";
 *   3. tidak ada keduanya → kosong, guru mengetik.
 *
 *  KEHADIRAN SISWA TIDAK PERNAH DIISI DIAM-DIAM (CLAUDE.md #10): simpan cepat hanya menulis MATERI. Kehadiran baru
 *  "Hadir semua" bila guru memilihnya dengan tegas; selain itu barisnya dibuat KOSONG untuk dilengkapi di halaman Jurnal.
 *  Jurnal yang sudah ada tidak pernah dihapus-tulis dari sini — hanya materinya yang diperbarui, nilai tidak disentuh. */

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
export const wibIso = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const menit = (j: string) => { const [h, m] = j.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export interface KartuJurnal {
  scheduleId: string; classId: string; kelas: string; tingkat: number; mapel: string;
  mulai: string; selesai: string; jp: number; jamKe: string | null;
  keadaan: "LEWAT" | "BERLANGSUNG" | "NANTI";
  /** Materi ke-N hari itu yang diisi kartu ini: guru yang mengajar kelas & mapel yang sama DUA KALI sehari mendapat dua
   *  kartu, dan kartu kedua mengisi materi 2 (dulu keduanya menimpa jurnal yang sama). */
  urutan: number;
  jurnalId: string | null; materi: string | null; kehadiranKosong: number;
  saran: { teks: string; asal: "RENCANA" | "LANJUTAN" } | null;
  tertinggal: number | null;
}

/** Awal semester berjalan (YYYY-MM-DD) + nomor pekan efektif tanggal itu. Disinggahkan 10 menit per tanggal. */
const g = globalThis as unknown as { __pekanKini?: Map<string, { nilai: { mulai: string; pekan: number; tahunAjaran: string; semester: string; label: string }; sampai: number }> };
export async function pekanKini(tanggal = wibIso()) {
  const peta = (g.__pekanKini ??= new Map());
  const ada = peta.get(tanggal);
  if (ada && ada.sampai > Date.now()) return ada.nilai;
  const sem = semesterAktif();
  const ta = await prisma.academicYear.findFirst({ where: { name: sem.tahunAjaran }, select: { id: true } }).catch(() => null);
  const r = ta ? await rentangSemesterTA(ta.id, sem.semester).catch(() => null) : null;
  const mulai = r?.mulai ?? (sem.semester === "GANJIL" ? `${sem.tahunAjaran.slice(0, 4)}-07-01` : `${sem.tahunAjaran.slice(5, 9)}-01-01`);
  const nilai = { mulai, pekan: await pekanEfektifKe(mulai, tanggal).catch(() => 0), tahunAjaran: sem.tahunAjaran, semester: sem.semester, label: sem.label };
  peta.set(tanggal, { nilai, sampai: Date.now() + 10 * 60_000 });
  if (peta.size > 20) peta.delete(peta.keys().next().value as string);
  return nilai;
}

export async function jadwalHariGuru(teacherId: string, tanggal = wibIso()): Promise<{ tanggal: string; libur: string | null; kartu: KartuJurnal[] }> {
  const libur = await cekLibur(tanggal).catch(() => null);
  if (libur) return { tanggal, libur: libur.nama, kartu: [] };
  const hari = new Date(`${tanggal}T00:00:00Z`), besok = new Date(hari.getTime() + 86400000);
  const namaHari = HARI[hari.getUTCDay()];
  const [minggu, jadwal, periode, pk] = await Promise.all([
    getWeekTypeForDate(hari),
    prisma.schedule.findMany({
      where: { teacherId, day: namaHari, scheduleType: "BLOK" },
      select: { id: true, classId: true, subject: true, startTime: true, endTime: true, weekType: true, class: { select: { name: true, grade: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.schoolPeriod.findMany({ where: { day: namaHari, isBreak: false }, select: { startTime: true }, orderBy: { startTime: "asc" } }).catch(() => []),
    pekanKini(tanggal),
  ]);
  const blok = groupConsecutiveSchedules(jadwal.filter(s => weekTypesOverlap(s.weekType, minggu)), s => `${s.classId}|${s.subject}`)
    .sort((a, b) => a.first.startTime.localeCompare(b.first.startTime));
  if (!blok.length) return { tanggal, libur: null, kartu: [] };

  const kelasIds = [...new Set(blok.map(b => b.first.classId))], mapel = [...new Set(blok.map(b => b.first.subject))];
  const [jurnal, rencana] = await Promise.all([
    prisma.teachingJournal.findMany({
      where: { teacherId, classId: { in: kelasIds }, subject: { in: mapel }, semester: pk.label },
      select: { id: true, classId: true, subject: true, date: true, materi: true, urutan: true, entries: { select: { attendanceStatus: true } } },
      orderBy: [{ date: "asc" }, { urutan: "asc" }],
    }),
    prisma.rencanaAjar.findMany({ where: { teacherId, subject: { in: mapel }, tahunAjaran: pk.tahunAjaran, semester: pk.semester }, select: { subject: true, tingkat: true, items: true } }),
  ]);
  const kini = new Date(Date.now() + 7 * 3600_000), hariIni = kini.toISOString().slice(0, 10), menitKini = kini.getUTCHours() * 60 + kini.getUTCMinutes();
  const urutJam = periode.map(p => p.startTime);

  const hitungBlok = new Map<string, number>(), jumlahBlok = new Map<string, number>();
  for (const b of blok) { const k = `${b.first.classId}|${b.first.subject}`; jumlahBlok.set(k, (jumlahBlok.get(k) ?? 0) + 1); }
  const kartu = blok.map((b): KartuJurnal => {
    const f = b.first, punya = jurnal.filter(j => j.classId === f.classId && j.subject === f.subject);
    const kunci = `${f.classId}|${f.subject}`, urutan = (hitungBlok.get(kunci) ?? 0) + 1; hitungBlok.set(kunci, urutan);
    const hariItu = punya.filter(j => j.date >= hari && j.date < besok);
    // Satu blok sehari: kartu mewakili seluruh jurnal hari itu. Beberapa blok: tiap kartu = materinya sendiri.
    const hariIniJ = ((jumlahBlok.get(kunci) ?? 1) > 1 ? hariItu.find(j => j.urutan === urutan) : hariItu[0]) ?? null;
    const lalu = punya.filter(j => j.date < hari);
    const butir = bacaButir(rencana.find(r => r.subject === f.subject && r.tingkat === f.class.grade)?.items);
    const maju = butir.length ? kemajuanRencana(butir, lalu.map(j => j.materi), pk.pekan) : null;
    const terakhir = lalu[lalu.length - 1]?.materi ?? null;
    const a = urutJam.indexOf(f.startTime), z = a >= 0 ? a + b.items.length - 1 : -1;
    const keadaan = tanggal < hariIni ? "LEWAT" : tanggal > hariIni ? "NANTI"
      : menitKini >= menit(b.last.endTime) ? "LEWAT" : menitKini >= menit(f.startTime) ? "BERLANGSUNG" : "NANTI";
    return {
      scheduleId: f.id, classId: f.classId, kelas: f.class.name, tingkat: f.class.grade, mapel: f.subject,
      mulai: f.startTime, selesai: b.last.endTime, jp: b.items.length,
      jamKe: a >= 0 ? (z > a ? `${a + 1}–${z + 1}` : `${a + 1}`) : null, keadaan,
      urutan,
      jurnalId: hariIniJ?.id ?? null, materi: !hariIniJ ? null : (jumlahBlok.get(kunci) ?? 1) > 1 ? hariIniJ.materi : hariItu.map(j => j.materi).join(" · "),
      kehadiranKosong: hariIniJ && hariIniJ.urutan === 1 ? hariIniJ.entries.filter(e => !e.attendanceStatus).length : 0,
      saran: maju?.berikut ? { teks: maju.berikut.materi, asal: "RENCANA" } : terakhir && !maju ? { teks: terakhir, asal: "LANJUTAN" } : null,
      tertinggal: maju?.tertinggal ?? null,
    };
  });
  return { tanggal, libur: null, kartu };
}

export type HasilSimpanCepat = { ok: true; baru: boolean; kelas: string } | { ok: false; pesan: string; kode: number };

/** Simpan jurnal ringkas untuk SATU blok jadwal milik guru itu pada tanggal itu. */
export async function simpanJurnalCepat(o: { teacherId: string; scheduleId: string; tanggal?: string; materi: string; semuaHadir?: boolean }): Promise<HasilSimpanCepat> {
  const tanggal = o.tanggal ?? wibIso(), materi = o.materi.trim().slice(0, 1000);
  if (!materi) return { ok: false, pesan: "Materi yang diajarkan belum diisi.", kode: 400 };
  if (tanggal > wibIso()) return { ok: false, pesan: "Jurnal tidak bisa diisi untuk hari yang belum tiba.", kode: 400 };
  const { kartu } = await jadwalHariGuru(o.teacherId, tanggal);
  const k = kartu.find(x => x.scheduleId === o.scheduleId);
  // Jadwal harus milik guru itu DAN memang berlaku pada tanggal itu — id dari klien/Telegram tidak dipercaya begitu saja.
  if (!k) return { ok: false, pesan: "Jam pelajaran itu tidak ada di jadwal Anda pada tanggal ini.", kode: 403 };
  if (k.keadaan === "NANTI") return { ok: false, pesan: "Jam pelajaran itu belum dimulai.", kode: 400 };
  const hari = new Date(`${tanggal}T00:00:00Z`), besok = new Date(hari.getTime() + 86400000);
  const pk = await pekanKini(tanggal);
  // Kartu ke-N untuk kelas & mapel yang sama mengisi MATERI ke-N. Materi harus berurutan (kehadiran ada di materi 1), jadi
  // bila materi sebelumnya belum ada, yang diisi adalah nomor kosong berikutnya.
  const hariItu = await prisma.teachingJournal.findMany({ where: { teacherId: o.teacherId, classId: k.classId, subject: k.mapel, date: { gte: hari, lt: besok } }, orderBy: { urutan: "asc" }, select: { id: true, urutan: true, entries: { select: { studentId: true } } } });
  const ada = hariItu.find(j => j.urutan === k.urutan) ?? null;
  const siswa = await prisma.student.findMany({ where: { classId: k.classId, studentStatus: "AKTIF" }, select: { id: true } });
  if (ada) {
    const punya = new Set(ada.entries.map(e => e.studentId));
    await prisma.$transaction([
      prisma.teachingJournal.update({ where: { id: ada.id }, data: { materi } }),
      ...(o.semuaHadir && ada.urutan === 1 ? [
        prisma.journalEntry.updateMany({ where: { journalId: ada.id, attendanceStatus: null }, data: { attendanceStatus: "HADIR" } }),
        prisma.journalEntry.createMany({ data: siswa.filter(s => !punya.has(s.id)).map(s => ({ journalId: ada.id, studentId: s.id, attendanceStatus: "HADIR" })) }),
      ] : []),
    ]);
    return { ok: true, baru: false, kelas: k.kelas };
  }
  const urutan = Math.min(k.urutan, (hariItu[hariItu.length - 1]?.urutan ?? 0) + 1);
  await prisma.teachingJournal.create({
    data: {
      teacherId: o.teacherId, classId: k.classId, subject: k.mapel, date: hari, semester: pk.label, materi, urutan,
      entries: { create: siswa.map(s => ({ studentId: s.id, attendanceStatus: o.semuaHadir && urutan === 1 ? "HADIR" : null })) },
    },
  });
  return { ok: true, baru: true, kelas: k.kelas };
}
