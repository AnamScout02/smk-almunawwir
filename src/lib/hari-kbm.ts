import "server-only";
import { prisma } from "@/lib/prisma";
import { daftarLibur } from "@/lib/hari-libur";
import { KODE, tebakKode } from "@/lib/kalender-matriks";

/** HARI TANPA KBM dalam satu rentang (10 Okt 2026) — dipakai menghitung "pertemuan terjadwal". Tanpa ini pekan sumatif
 *  dihitung sebagai jam mengajar yang jurnalnya kosong. Sebuah hari sekolah dianggap TANPA KBM bila:
 *   1. libur (satu sumber `daftarLibur`), atau
 *   2. tercakup Kegiatan Ujian AKTIF berjenis sumatif (STS/SAS/SAT/PSAJ) untuk tingkat itu — hanya kegiatan ≤ 21 hari:
 *      kegiatan yang membentang berbulan-bulan adalah wadah ujian, bukan hari tanpa pelajaran, atau
 *   3. agenda Kalender Pendidikan berkode KTS / PR (kegiatan tengah semester, pembagian rapor), atau STS / SAS **bila
 *      tidak ada Kegiatan Ujian sejenis** di rentang itu — tanggal di Pusat Ujian lebih tepat daripada kalender rencana.
 *  Yang SENGAJA tidak dihitung tanpa KBM: agenda berjenis UJIAN lain (simulasi/gladi ANBK hanya diikuti siswa sampel,
 *  pelajaran tetap jalan) dan kegiatan sekolah umum — menebaknya dari judul lebih sering salah daripada benar. */
const SUMATIF = ["STS", "SAS", "SAT", "PSAJ"];
export async function hariTanpaKbm(dari: string, sampai: string) {
  const awal = new Date(`${dari}T00:00:00Z`), akhir = new Date(`${sampai}T00:00:00Z`);
  const [libur, agenda, ujian] = await Promise.all([
    daftarLibur(dari, sampai),
    prisma.schoolEvent.findMany({ where: { tanggalMulai: { lte: akhir }, tanggalSelesai: { gte: awal } }, select: { judul: true, jenis: true, hariEfektif: true, kode: true, tanggalMulai: true, tanggalSelesai: true } }).catch(() => []),
    prisma.kegiatanUjian.findMany({ where: { aktif: true, jenis: { in: SUMATIF }, tanggalMulai: { lte: akhir }, tanggalSelesai: { gte: awal } }, select: { jenis: true, tanggalMulai: true, tanggalSelesai: true, tingkat: true } }).catch(() => []),
  ]);
  const setLibur = new Set(libur.map(l => l.tanggal));
  /** tanggal → tingkat yang tanpa KBM ("*" = semua). */
  const peta = new Map<string, Set<number | "*">>();
  const tandai = (a: Date, z: Date, tingkat: (number | "*")[]) => {
    for (let t = a.getTime(); t <= z.getTime(); t += 86400000) {
      const k = new Date(t).toISOString().slice(0, 10);
      const s = peta.get(k) ?? new Set<number | "*">();
      tingkat.forEach(x => s.add(x)); peta.set(k, s);
    }
  };
  const adaKegiatan = new Set<string>();
  for (const u of ujian) {
    if (!u.tanggalMulai || !u.tanggalSelesai || (u.tanggalSelesai.getTime() - u.tanggalMulai.getTime()) / 86400000 > 21) continue;
    adaKegiatan.add(u.jenis);
    tandai(u.tanggalMulai, u.tanggalSelesai, u.tingkat.length ? u.tingkat : ["*"]);
  }
  for (const a of agenda) {
    const kode = a.kode && KODE[a.kode] ? a.kode : tebakKode(a.judul, a.jenis, a.hariEfektif);
    if (kode === "KTS" || kode === "PR" || ((kode === "STS" || kode === "SAS") && !adaKegiatan.has(kode))) tandai(a.tanggalMulai, a.tanggalSelesai, ["*"]);
  }
  return {
    libur: (tgl: string) => setLibur.has(tgl),
    ujian: (tgl: string, tingkat: number) => { const s = peta.get(tgl); return !!s && (s.has("*") || s.has(tingkat)); },
  };
}

/** Hari PERTAMA sekolah benar-benar berjalan pada semester itu = catatan paling awal di antara jurnal mengajar, catatan
 *  guru piket, dan absensi siswa. Awal tahun ajaran di data (1 Juli) lebih dulu daripada hari pertama masuk, dan kalender
 *  belum tentu menandai jeda itu sebagai libur — menghitung dari 1 Juli menambah ±3 pekan "pertemuan" yang tidak pernah ada.
 *  Belum ada catatan sama sekali → awal semester. */
export async function awalKbm(mulaiSemester: string): Promise<string> {
  const awal = new Date(`${mulaiSemester}T00:00:00Z`);
  const [j, p, a] = await Promise.all([
    prisma.teachingJournal.findFirst({ where: { date: { gte: awal } }, orderBy: { date: "asc" }, select: { date: true } }).catch(() => null),
    prisma.teacherScheduleAttendance.findFirst({ where: { date: { gte: awal } }, orderBy: { date: "asc" }, select: { date: true } }).catch(() => null),
    prisma.attendance.findFirst({ where: { date: { gte: awal } }, orderBy: { date: "asc" }, select: { date: true } }).catch(() => null),
  ]);
  const t = [j?.date, p?.date, a?.date].filter((x): x is Date => !!x).map(x => x.toISOString().slice(0, 10)).sort()[0];
  return t && t > mulaiSemester ? t : mulaiSemester;
}
