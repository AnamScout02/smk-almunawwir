import "server-only";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { daftarLibur } from "@/lib/hari-libur";
import { bagianWib } from "@/lib/waktu-wib";

/** IZIN/SAKIT ONLINE (17 Sep 2026). Aturan (patokan disepakati user, bisa disesuaikan di sini):
 * - diajukan orang tua paling lambat H+1 (tanggal mulai ≥ kemarin, WIB), rentang maksimal 14 hari;
 * - SAKIT lebih dari 2 hari sekolah wajib melampirkan foto surat dokter;
 * - wali kelas menyetujui/menolak; Wakasek Kesiswaan & Guru BK memantau (baca saja); Admin boleh keduanya. */
export const MAKS_HARI_IZIN = 14;
export const SAKIT_WAJIB_SURAT_LEBIH_DARI = 2;
export const FOLDER_LAMPIRAN = join(process.cwd(), "public", "uploads", "rahasia", "izin-siswa");

export const hariIniWib = () => bagianWib().iso;
export const isoTanggal = (d: Date) => d.toISOString().slice(0, 10);
export const tanggalUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Hari sekolah (bukan Minggu/libur) dalam rentang, format YYYY-MM-DD. */
export async function hariSekolah(mulai: string, selesai: string): Promise<string[]> {
  const libur = new Set((await daftarLibur(mulai, selesai)).map(l => l.tanggal));
  const hasil: string[] = [];
  for (let t = tanggalUtc(mulai); isoTanggal(t) <= selesai; t = new Date(t.getTime() + 86400000)) {
    const iso = isoTanggal(t);
    if (!libur.has(iso)) hasil.push(iso);
  }
  return hasil;
}

/** Cakupan pengelola izin untuk portal guru/admin: `null` = semua kelas; array = kelas wali saja. `ubah` = boleh memutuskan. */
export async function cakupanIzin(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return { kelas: null as string[] | null, ubahKelas: null as string[] | null };
  const [t, jabatan] = await Promise.all([
    prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } }),
    getJabatanNames(session.email),
  ]);
  const wali = t?.homeroomOf.map(c => c.id) ?? [];
  const pemantau = KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j));
  return { kelas: pemantau ? null : wali, ubahKelas: wali };
}

/** Boleh melihat lampiran pengajuan ini? Orang tua siswa itu, wali kelasnya, Kesiswaan/BK, atau Admin. */
export async function bolehLihatIzin(session: { role: string; email: string; userId: string }, izin: { studentId: string; diajukanOleh: string }) {
  if (session.role === "ADMIN") return true;
  if (session.role === "PARENT") {
    const tautan = await prisma.parentStudent.findFirst({ where: { studentId: izin.studentId, parent: { userId: session.userId } }, select: { id: true } });
    return !!tautan;
  }
  if (session.role === "TEACHER" || session.role === "TAS") {
    const c = await cakupanIzin(session);
    if (c.kelas === null) return true;
    const s = await prisma.student.findUnique({ where: { id: izin.studentId }, select: { classId: true } });
    return !!s?.classId && c.kelas.includes(s.classId);
  }
  return false;
}

export const labelTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const labelRentang = (a: string, b: string) => (a === b ? labelTanggal(a) : `${labelTanggal(a)} – ${labelTanggal(b)}`);
