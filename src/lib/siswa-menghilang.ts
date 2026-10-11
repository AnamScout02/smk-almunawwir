import "server-only";
import { prisma } from "@/lib/prisma";

const H = 86_400_000;
/** Jumlah hari berabsensi terakhir (milik KELAS siswa itu) yang dilihat, dan ambang alpha di dalamnya. */
export const HARI_DILIHAT = 20, MIN_ALPHA = 15;

export type SiswaMenghilang = { id: string; nama: string; nis: string; kelas: string; alpha: number; hari: number; terakhirHadir: Date | null };

/** SISWA "AKTIF" YANG DIDUGA SUDAH TIDAK BERSEKOLAH (11 Okt 2026) — untuk ditindak Tata Usaha lewat Mutasi Siswa.
 *  Aturan (bukan tebakan model): pada 20 hari TERAKHIR yang kelasnya punya catatan absensi, siswa itu tidak sekali pun
 *  HADIR dan alpha (atau tanpa catatan sama sekali) pada ≥15 hari. Izin/sakit panjang tidak ditandai — itu urusan lain.
 *  Kelas yang absensinya belum 15 hari tidak dinilai (mis. kelas yang sedang PKL), supaya "tidak diabsen" tidak terbaca
 *  sebagai "menghilang". Hasilnya DAFTAR UNTUK DIPERIKSA: status siswa hanya berubah bila petugas mengisi Mutasi Siswa. */
export async function siswaMenghilang(): Promise<SiswaMenghilang[]> {
  const sejak = new Date(Date.now() - 150 * H);
  const [siswa, absen, hadirAkhir] = await Promise.all([
    prisma.student.findMany({ where: { studentStatus: "AKTIF", classId: { not: null } }, select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } } }),
    prisma.attendance.findMany({ where: { date: { gte: sejak }, student: { studentStatus: "AKTIF", classId: { not: null } } }, select: { studentId: true, date: true, status: true } }),
    prisma.attendance.groupBy({ by: ["studentId"], where: { status: "HADIR" }, _max: { date: true } }),
  ]);
  const kelasDari = new Map(siswa.map(s => [s.id, s.classId as string]));
  const tgl = (d: Date) => d.toISOString().slice(0, 10);
  const hariKelas = new Map<string, Set<string>>(), milik = new Map<string, Map<string, string>>();
  for (const a of absen) {
    const k = kelasDari.get(a.studentId); if (!k) continue;
    const t = tgl(a.date);
    if (!hariKelas.has(k)) hariKelas.set(k, new Set()); hariKelas.get(k)!.add(t);
    if (!milik.has(a.studentId)) milik.set(a.studentId, new Map()); milik.get(a.studentId)!.set(t, a.status);
  }
  const jendela = new Map([...hariKelas].map(([k, s]) => [k, [...s].sort().slice(-HARI_DILIHAT)]));
  const terakhir = new Map(hadirAkhir.map(x => [x.studentId, x._max.date]));
  const hasil: SiswaMenghilang[] = [];
  for (const s of siswa) {
    const hari = jendela.get(s.classId as string) ?? [];
    if (hari.length < MIN_ALPHA) continue;
    const m = milik.get(s.id);
    let alpha = 0, hadir = 0;
    for (const t of hari) { const st = m?.get(t); if (st === "HADIR") hadir++; else if (!st || st === "ALPHA") alpha++; }
    if (hadir > 0 || alpha < MIN_ALPHA) continue;
    hasil.push({ id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "", alpha, hari: hari.length, terakhirHadir: terakhir.get(s.id) ?? null });
  }
  return hasil.sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nama.localeCompare(b.nama, "id"));
}
