import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

/** BKK — LOWONGAN KERJA (17 Sep 2026). Pengelola: Admin, staf TU, Koordinator BKK, Wakil Kepala Humas.
 * Pembaca: siswa AKTIF kelas XII (alumni menyusul bila login alumni dibuka — keputusan user). */
export async function kelolaBkk(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  const j = await getJabatanNames(s.email);
  return j.includes("Koordinator BKK") || j.includes("Wakil Kepala Humas") || j.some(n => TAS_JABATAN.includes(n));
}

/** Siswa yang boleh melihat lowongan (kelas XII aktif), beserta jurusannya. */
export async function pembacaLowongan(s: { role: string; userId: string }) {
  if (s.role !== "STUDENT") return null;
  const st = await prisma.student.findFirst({
    where: { userId: s.userId, studentStatus: "AKTIF", class: { grade: 12 } },
    select: { id: true, majorId: true },
  });
  return st;
}

export const JENIS_LOWONGAN: Record<string, string> = { PENUH_WAKTU: "Penuh waktu", PARUH_WAKTU: "Paruh waktu", KONTRAK: "Kontrak", MAGANG: "Magang" };
export const STATUS_MINAT: Record<string, string> = { BERMINAT: "Berminat", DIKIRIM: "Berkas dikirim ke perusahaan", PANGGILAN: "Dipanggil tes/wawancara", DITERIMA: "Diterima", TIDAK_LOLOS: "Tidak lolos" };

/** Validasi isian lowongan (dipakai POST & PUT). */
export function rapikanLowongan(b: Record<string, unknown>) {
  const teks = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const url = teks(b.tautanLamar, 500);
  return {
    judul: teks(b.judul, 150), perusahaan: teks(b.perusahaan, 150), lokasi: teks(b.lokasi, 150) || null,
    jenis: JENIS_LOWONGAN[String(b.jenis)] ? String(b.jenis) : "PENUH_WAKTU",
    jurusanIds: Array.isArray(b.jurusanIds) ? [...new Set(b.jurusanIds.map(String))].slice(0, 20) : [],
    kualifikasi: teks(b.kualifikasi, 3000), deskripsi: teks(b.deskripsi, 5000) || null, gaji: teks(b.gaji, 100) || null,
    batas: b.batas ? new Date(String(b.batas)) : null, kontak: teks(b.kontak, 200) || null,
    tautanLamar: /^https?:\/\//.test(url) ? url : null,
    posterUrl: typeof b.posterUrl === "string" && b.posterUrl.startsWith("/uploads/") ? b.posterUrl : null,
    partnerId: typeof b.partnerId === "string" && b.partnerId ? b.partnerId : null,
    aktif: b.aktif !== false,
  };
}
