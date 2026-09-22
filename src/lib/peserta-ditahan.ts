import "server-only";
import { prisma } from "@/lib/prisma";

/** PESERTA DITAHAN (21 September 2026) — siswa yang belum boleh mengikuti ujian dalam satu kegiatan (lazimnya belum
 * menyelesaikan administrasi ujian). Satu sumber untuk: jalur masuk token (ditolak), halaman mulai & daftar ujian siswa
 * (keterangan), papan pantau/Ruang Kendali (status "Ditahan"), dan halaman Administrasi (kelola). Pengerjaan yang
 * SUDAH dimulai sebelum ditahan tetap boleh dilanjutkan — penahanan hanya mencegah MASUK. */

export const PESAN_DITAHAN = "Anda belum bisa mengikuti ujian ini";

/** Alasan penahanan siswa pada kegiatan itu, atau null bila tidak ditahan. */
export async function alasanDitahan(kegiatanId: string | null | undefined, studentId: string): Promise<string | null> {
  if (!kegiatanId) return null;
  const d = await prisma.pesertaDitahanUjian.findUnique({
    where: { kegiatanId_studentId: { kegiatanId, studentId } }, select: { alasan: true },
  }).catch(() => null);
  return d ? d.alasan || "Belum menyelesaikan administrasi ujian" : null;
}

/** Peta siswa → alasan untuk satu kegiatan (papan pantau, daftar siswa). */
export async function petaDitahan(kegiatanId: string | null | undefined, studentIds?: string[]): Promise<Map<string, string>> {
  if (!kegiatanId) return new Map();
  const baris = await prisma.pesertaDitahanUjian.findMany({
    where: { kegiatanId, ...(studentIds ? { studentId: { in: studentIds } } : {}) }, select: { studentId: true, alasan: true },
  }).catch(() => []);
  return new Map(baris.map(b => [b.studentId, b.alasan]));
}

/** Kegiatan-kegiatan tempat seorang siswa ditahan (daftar ujian siswa). */
export async function kegiatanDitahanSiswa(studentId: string): Promise<Map<string, string>> {
  const baris = await prisma.pesertaDitahanUjian.findMany({ where: { studentId }, select: { kegiatanId: true, alasan: true } }).catch(() => []);
  return new Map(baris.map(b => [b.kegiatanId, b.alasan]));
}

export const pesanDitahan = (alasan: string) => `${PESAN_DITAHAN}: ${alasan}. Silakan menghubungi Tata Usaha / panitia ujian.`;
