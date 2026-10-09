import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/** FOTO JURNAL TERVERIFIKASI (9 Okt 2026). Foto yang diambil dari KAMERA DI HALAMAN diunggah lewat
 *  /api/student/pkl/foto; server mencatat WAKTU SERVER saat foto diterima dan menerbitkan tanda (HMAC) atas
 *  alamat foto + waktu + siswa. Jurnal yang menyertakan tanda sah dicap `fotoTerverifikasi`. Foto dari galeri
 *  diunggah lewat jalur biasa, tidak punya tanda, dan tampil sebagai "foto tidak terverifikasi".
 *
 *  Batas yang jujur: ini membuktikan foto DIKIRIM lewat jalur kamera pada waktu itu, bukan mustahil diakali —
 *  siswa yang paham teknis bisa mengirim berkas lain ke jalur yang sama. Cukup untuk menutup cara yang lazim
 *  (memakai foto lama dari galeri), tidak untuk menggantikan monitoring guru. */
const kunci = () => process.env.SESSION_SECRET || "";
export const MASA_TANDA_MS = 20 * 60_000;

export function tandaFoto(url: string, waktu: number, studentId: string): string {
  return createHmac("sha256", kunci()).update(`pkl-foto|${url}|${waktu}|${studentId}`).digest("base64url").slice(0, 32);
}

/** Tanda sah DAN belum kedaluwarsa (jurnal harus disimpan tak lama setelah foto diambil). */
export function tandaFotoSah(url: string, waktu: number, studentId: string, tanda: string): boolean {
  if (!kunci() || !url || !Number.isFinite(waktu) || typeof tanda !== "string") return false;
  if (Date.now() - waktu > MASA_TANDA_MS || waktu > Date.now() + 60_000) return false;
  const a = Buffer.from(tandaFoto(url, waktu, studentId)), b = Buffer.from(tanda);
  return a.length === b.length && timingSafeEqual(a, b);
}
