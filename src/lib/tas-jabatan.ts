/** Daftar jabatan Tata Usaha "penuh" — dipisah dari `tas-access-guard.ts` (server-only) supaya
 * komponen KLIEN (sidebar TAS & kisi menu) bisa ikut memakai aturan yang sama tanpa menarik
 * `server-only` ke bundel browser. Satu sumber: guard server mengimpor dari sini. */
export const TAS_JABATAN = ["Tenaga Administrasi Sekolah", "Kepala Tenaga Administrasi Sekolah"];

export function isFullTasJabatan(jabatanNames: string[]): boolean {
  return jabatanNames.some(n => TAS_JABATAN.includes(n));
}
