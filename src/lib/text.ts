/** Ubah "BUDI SANTOSO", "budi santoso", dsb jadi "Budi Santoso" — dipakai supaya nama,
 * alamat, dan data teks bebas lain konsisten Proper Case apa pun cara input aslinya. */
export function toProperCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s.'/-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Sama seperti toProperCase, tapi untuk nama orang berformat "Nama, Gelar" — bagian SEBELUM
 * koma pertama saja yang di-Proper Case, gelar akademik setelahnya (S.Pd, M.Pt, ST, SE, dst)
 * dibiarkan apa adanya karena kapitalisasi gelar tidak mengikuti aturan per-kata biasa. */
export function toProperCaseName(s: string): string {
  const idx = s.indexOf(",");
  if (idx === -1) return toProperCase(s);
  return toProperCase(s.slice(0, idx)) + s.slice(idx);
}

/** Field bebas-teks (nama & alamat) di bukuIndukData yang wajib Proper Case — field berbasis
 * dropdown master-data (agama, pekerjaan, dll) sengaja tidak disentuh karena sudah terkontrol. */
export const FREE_TEXT_BUKU_INDUK_KEYS = [
  "nickname",
  "dusun", "fatherDusun", "motherDusun", "guardianDusun",
  "desa", "fatherDesa", "motherDesa", "guardianDesa",
  "kecamatan", "fatherKecamatan", "motherKecamatan", "guardianKecamatan",
  "kabupaten", "fatherKabupaten", "motherKabupaten", "guardianKabupaten",
  "province", "fatherProvince", "motherProvince", "guardianProvince",
  "prevSchoolAddress", "fatherName", "motherName", "guardianName",
  "pklPlace", "pklSupervisor", "transferTo", "pindahanDari",
] as const;

const NAME_KEYS = ["fatherName", "motherName", "guardianName"];

/** Terapkan toProperCase ke field bebas-teks dalam objek bukuIndukData (JSON), tanpa
 * menyentuh field lain (tanggal, NIK, kode, atau field dropdown yang sudah terkontrol).
 * Nama orang tua/wali pakai toProperCaseName supaya gelar akademik di belakang koma tidak diubah. */
export function normalizeBukuIndukText<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of FREE_TEXT_BUKU_INDUK_KEYS) {
    const v = out[key];
    if (typeof v === "string" && v.trim()) {
      out[key] = NAME_KEYS.includes(key) ? toProperCaseName(v) : toProperCase(v);
    }
  }
  return out as T;
}
