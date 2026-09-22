import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export type JenisQrRapor = "AKHIR" | "TS" | "DINIYAH";

/** QR keaslian rapor (pola CLAUDE.md #49). Token dibuat SEKALI per siswa × semester × jenis (unik di DB, jadi cetak ulang
 * memakai token yang sama), HANYA untuk rapor yang sudah disahkan — pemanggil wajib memeriksa `disahkan`. Mengembalikan
 * siswaId → gambar QR (data URL). */
export async function qrRapor(siswaIds: string[], semester: string, jenis: JenisQrRapor, kelasNama: string): Promise<Record<string, string>> {
  if (!siswaIds.length) return {};
  await prisma.raporVerifikasi.createMany({
    data: siswaIds.map(studentId => ({ studentId, semester, jenis, kelasNama, token: randomBytes(18).toString("base64url") })),
    skipDuplicates: true, // unik (studentId, semester, jenis) di DB — token lama dipertahankan
  });
  const baris = await prisma.raporVerifikasi.findMany({ where: { studentId: { in: siswaIds }, semester, jenis }, select: { studentId: true, token: true } });
  const hasil = await Promise.all(baris.map(async b => [b.studentId, await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/rapor/${b.token}`)] as const));
  return Object.fromEntries(hasil);
}

export const jenisQrDari = (jenis: string): JenisQrRapor | null => (jenis === "akhir" ? "AKHIR" : jenis === "ts" ? "TS" : jenis === "diniyah" ? "DINIYAH" : null);
