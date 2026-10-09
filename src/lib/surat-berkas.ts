import "server-only";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";

/** PINDAIAN SURAT MASUK disimpan di folder RAHASIA (diblokir proxy, CLAUDE.md #44/#50): surat dinas bisa memuat nama siswa,
 *  sanksi, atau urusan kepegawaian. Dibuka hanya lewat /api/surat/berkas/<nama>. */
export const FOLDER_SURAT = join(process.cwd(), "public", "uploads", "rahasia", "surat-masuk");
export const MIME_SURAT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export const alamatBerkasSurat = (nama: string) => `/api/surat/berkas/${nama}`;

type Sesi = { role: string; email: string; userId: string; name: string };
const TU = ["Kepala Tata Usaha", "Kepala Tenaga Administrasi Sekolah", "Staf Tata Usaha", "Operator Sekolah"];

/** Nama + jabatan akun — dasar mencocokkan "tujuan" disposisi (disimpan sebagai nama jabatan ATAU nama orang). */
export async function sebutanSaya(s: Sesi) { return [...new Set([s.name, ...(await getJabatanNames(s.email))])].filter(Boolean); }

/** Pimpinan yang berwenang MENDISPOSISI: Kepala Sekolah (guru berjabatan) dan Admin. */
export async function pimpinanSurat(s: Sesi) { return s.role === "ADMIN" || (await getJabatanNames(s.email)).includes("Kepala Sekolah"); }

/** Boleh membuka pindaian: Admin, staf TU (peran TAS), pimpinan, guru berjabatan TU, atau orang yang DITUJU disposisi surat itu. */
export async function bolehBukaSurat(s: Sesi, nama: string) {
  if (s.role === "ADMIN" || s.role === "TAS") return true;
  if (s.role !== "TEACHER") return false;
  const sebutan = await sebutanSaya(s);
  if (sebutan.includes("Kepala Sekolah") || sebutan.some(x => TU.includes(x))) return true;
  const n = await prisma.disposisi.count({ where: { surat: { fileUrl: alamatBerkasSurat(nama) }, tujuan: { hasSome: sebutan } } });
  return n > 0;
}
