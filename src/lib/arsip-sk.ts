import "server-only";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { BUKU_INDUK_FULL_JABATAN } from "@/lib/buku-induk-access";

/** ARSIP SK & DOKUMEN KEPEGAWAIAN (17 Sep 2026). Berkas di folder RAHASIA (diblokir proxy, dibuka lewat rute berizin).
 * Pengelola: Admin, staf TU, Operator Sekolah. Guru hanya melihat dokumennya sendiri. */
export const FOLDER_SK = join(process.cwd(), "public", "uploads", "rahasia", "kepegawaian");
export const JENIS_SK: Record<string, string> = {
  SK: "SK (pengangkatan/tugas)", SERTIFIKAT: "Sertifikat", PIAGAM: "Piagam penghargaan", IJAZAH: "Ijazah/transkrip", LAINNYA: "Lainnya",
};

export async function kelolaKepegawaian(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return (await getJabatanNames(s.email)).some(n => BUKU_INDUK_FULL_JABATAN.includes(n));
}

/** Guru yang sedang login (untuk melihat arsipnya sendiri). */
export async function guruSaya(userId: string) {
  return prisma.teacher.findFirst({ where: { userId }, select: { id: true } });
}
