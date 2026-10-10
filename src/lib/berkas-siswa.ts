import "server-only";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { BUKU_INDUK_FULL_JABATAN } from "@/lib/buku-induk-access";
import { BERKAS_POKOK, DARI_SPMB } from "@/lib/berkas-siswa-jenis";

/** BERKAS SISWA DIGITAL — dokumen pribadi (KK, akta, ijazah) di folder RAHASIA (CLAUDE.md #50). */
export const FOLDER_BERKAS_SISWA = join(process.cwd(), "public", "uploads", "rahasia", "berkas-siswa");
export const MIME_BERKAS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export const MAKS_BERKAS = 6 * 1024 * 1024; // di bawah batas badan permintaan proxy (10 MB, CLAUDE.md #116)

type Sesi = Awaited<ReturnType<typeof verifySession>>;
/** Hak atas berkas satu siswa. `kelola` (unggah/hapus) = Admin & pemegang akses Buku Induk penuh (TU, Operator Sekolah);
 *  `lihat` = itu + wali kelas siswa tersebut (aturan yang sama dengan Buku Induk Siswa). Orang lain: tidak sama sekali. */
export async function hakBerkasSiswa(session: Sesi, studentId: string) {
  if (session.role === "ADMIN") return { lihat: true, kelola: true };
  if (session.role !== "TEACHER" && session.role !== "TAS") return { lihat: false, kelola: false };
  if ((await getJabatanNames(session.email)).some(n => BUKU_INDUK_FULL_JABATAN.includes(n))) return { lihat: true, kelola: true };
  if (session.role !== "TEACHER") return { lihat: false, kelola: false };
  const wali = await prisma.student.count({ where: { id: studentId, class: { homeroom: { user: { email: session.email } } } } });
  return { lihat: wali > 0, kelola: false };
}

/** Jenis pokok yang BELUM ada untuk tiap siswa aktif — berkas unggahan ATAU dokumen pendaftaran SPMB sama-sama dihitung ada. */
export async function berkasPokokKurang() {
  const [siswa, berkas, spmb] = await Promise.all([
    prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } } }),
    prisma.berkasSiswa.findMany({ where: { jenis: { in: BERKAS_POKOK }, student: { studentStatus: "AKTIF" } }, select: { studentId: true, jenis: true } }),
    prisma.admission.findMany({ where: { studentId: { not: null } }, select: { studentId: true, ijazahUrl: true, kkUrl: true } }),
  ]);
  const ada = new Map<string, Set<string>>();
  const tandai = (id: string, j: string) => { if (!ada.has(id)) ada.set(id, new Set()); ada.get(id)!.add(j); };
  for (const b of berkas) tandai(b.studentId, b.jenis);
  for (const a of spmb) for (const [jenis, kolom] of Object.entries(DARI_SPMB)) if (a.studentId && BERKAS_POKOK.includes(jenis) && (a as Record<string, unknown>)[kolom]) tandai(a.studentId, jenis);
  return siswa.map(s => ({ id: s.id, nama: s.user.name, kelas: s.class?.name ?? "tanpa kelas", kurang: BERKAS_POKOK.filter(j => !ada.get(s.id)?.has(j)) })).filter(s => s.kurang.length > 0);
}
