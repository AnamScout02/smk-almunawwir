import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/** Tanda tangan ringkas pengganti tanggal lahir di alamat halaman cetak. Nilainya tetap (bukan
 *  kedaluwarsa) dan setara kuncinya dengan "nomor + tanggal lahir", tetapi TANGGAL LAHIR tidak ikut
 *  tertulis di URL — jadi tidak tertinggal di riwayat peramban komputer warnet/sekolah. */
export function tandaFormulir(nomor: string, lahirIso: string): string {
  const rahasia = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", rahasia).update(`formulir-spmb|${nomor.toUpperCase()}|${lahirIso}`).digest("base64url").slice(0, 32);
}

export function tandaCocok(nomor: string, lahirIso: string, tanda: string): boolean {
  const benar = Buffer.from(tandaFormulir(nomor, lahirIso));
  const diberi = Buffer.from(tanda ?? "");
  return benar.length === diberi.length && timingSafeEqual(benar, diberi);
}

/** Tanggal lahir baris Admission dalam bentuk "YYYY-MM-DD" WIB — dipakai memeriksa tanda. */
export function lahirIso(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
