import "server-only";

/**
 * Kritik / saran / apresiasi antar pegawai TANPA NAMA PENGIRIM (permintaan user 29 September 2026:
 * "guru a mau mengirimkan kritik maupun saran ke guru lain, tapi tanpa tahu siapa yang mengirim,
 * kecuali superadmin bisa cek semuanya").
 *
 * Aturan yang WAJIB dijaga di setiap route baru yang menyentuh model `MasukanRekan`:
 * 1. Route yang melayani PENERIMA tidak boleh pernah menyertakan `pengirimId` atau relasi
 *    `pengirim` dalam `select`/`include`. Menyembunyikannya di layar saja tidak cukup — datanya
 *    tidak boleh sampai ke browser penerima sama sekali.
 * 2. Hanya role ADMIN (superadmin) yang boleh melihat pasangan pengirim–penerima.
 * 3. Notifikasi ke penerima TIDAK menyebut nama pengirim.
 * 4. Layar pengirim WAJIB menyatakan bahwa Superadmin dapat melihat pengirimnya — anonim di sini
 *    berarti "tidak terlihat oleh penerima & rekan lain", bukan anonim mutlak.
 */
export const JENIS_MASUKAN = ["KRITIK", "SARAN", "APRESIASI"] as const;
export type JenisMasukan = (typeof JENIS_MASUKAN)[number];

export const LABEL_JENIS: Record<string, string> = {
  KRITIK: "Kritik", SARAN: "Saran", APRESIASI: "Apresiasi",
};

export const ISI_MAKS = 2000;

/** Peran yang boleh saling berkirim masukan: pegawai sekolah, bukan siswa/orang tua. */
export const PERAN_PEGAWAI = ["ADMIN", "TAS", "TEACHER"] as const;

export function jenisSah(v: unknown): v is JenisMasukan {
  return typeof v === "string" && (JENIS_MASUKAN as readonly string[]).includes(v);
}
