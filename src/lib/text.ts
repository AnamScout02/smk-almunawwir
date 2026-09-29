/** Ubah "BUDI SANTOSO", "budi santoso", dsb jadi "Budi Santoso" — dipakai supaya nama,
 * alamat, dan data teks bebas lain konsisten Proper Case apa pun cara input aslinya.
 * SENGAJA apostrof (') TIDAK dianggap pemisah kata (beda dari konvensi Barat "O'Brien") —
 * banyak nama sekolah/orang di data sekolah ini berasal dari transliterasi Arab yang pakai
 * apostrof sbg hamzah/ain di TENGAH kata ("Manba'ul", "Ma'arif", "Robi'ah"), huruf sesudahnya
 * TIDAK boleh kapital. Ditemukan user 2026-08-20 dari data nyata ("Manba'Ul Falah" yang salah,
 * seharusnya "Manba'ul Falah"). */
export function toProperCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s./-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

const SCHOOL_LEVEL_ABBR: Record<string, string> = {
  paud: "PAUD", kb: "KB", tk: "TK", ra: "RA",
  sd: "SD", mi: "MI", sdlb: "SDLB",
  smp: "SMP", mts: "MTs", smplb: "SMPLB",
  sma: "SMA", ma: "MA", smk: "SMK", mak: "MAK", smalb: "SMALB",
  pkbm: "PKBM", skb: "SKB",
  // Varian "Negeri" (akhiran N) — dulu TIDAK terdaftar, jadi "SMPN Sempu" jatuh ke
  // toProperCase polos dan jadi "Smpn Sempu". Ketahuan waktu impor 517 alumni 2026-09-12:
  // 262 nama sekolah jadi "Smpn ..." dan 12 jadi "Mtsn ...".
  sdn: "SDN", min: "MIN", smpn: "SMPN", mtsn: "MTsN",
  sman: "SMAN", man: "MAN", smkn: "SMKN", makn: "MAKN",
};

/** Sama seperti toProperCase, tapi mengenali & mempertahankan kapitalisasi BAKU singkatan
 * jenjang/jenis sekolah Indonesia (SMP, MTs, SMA, SMK, PKBM, dst) — toProperCase polos men-
 * title-case tiap kata tanpa terkecuali, jadi "SMP" jadi "Smp" dan "MTs" jadi "Mts" (salah,
 * ditemukan user 2026-08-20 di kolom Sekolah Asal Buku Induk). Khusus dipakai untuk
 * previousSchool — bukan pengganti toProperCase generik biasa.
 *
 * WAJIB cocok SATU KATA UTUH (dipisah spasi), bukan per-runtun-huruf — kalau dicek per-runtun-
 * huruf ("Manba'arif".match(/[A-Za-z]+/g) -> ["Ma", "arif"]), fragmen "Ma" di "Ma'arif" salah
 * ke-match sbg singkatan "MA" (Madrasah Aliyah) dan jadi "MA'arif" yang salah. */
export function toProperCaseSchoolName(s: string): string {
  return toProperCase(s)
    .split(/(\s+)/)
    .map(token => {
      const trailing = token.match(/[.,;:]+$/)?.[0] ?? "";
      const core = trailing ? token.slice(0, -trailing.length) : token;
      const fixed = SCHOOL_LEVEL_ABBR[core.toLowerCase()];
      return fixed ? fixed + trailing : token;
    })
    .join("");
}

/** Sama seperti toProperCase, tapi untuk nama orang berformat "Nama, Gelar" — bagian SEBELUM
 * koma pertama saja yang di-Proper Case, gelar akademik setelahnya (S.Pd, M.Pt, ST, SE, dst)
 * dibiarkan apa adanya karena kapitalisasi gelar tidak mengikuti aturan per-kata biasa. */
export function toProperCaseName(s: string): string {
  const idx = s.indexOf(",");
  if (idx === -1) return toProperCase(s);
  return toProperCase(s.slice(0, idx)) + s.slice(idx);
}

/** Nomor ijazah ("DN-05/D-SMP/K13/24/0017025", "MTs-24 130062916", dst) TIDAK boleh Proper Case
 * (toProperCase akan merusak kode jadi "Dn-05/D-Smp/..." — bukan format resmi apa pun) — malah
 * dibesarkan semua (kode resmi dari Kemdikbud/Kemenag memang huruf besar), KECUALI singkatan
 * "MTs" yang harus tetap persis begitu (bukan "MTS" all-caps) sesuai konvensi penulisan resmi.
 * Keputusan eksplisit user 2026-09-11: "jangan dibuat otomatis Proper ... dibesarkan semua,
 * kecuali MTs". Uppercase dulu baru "MTS" (hasil uppercase, apa pun casing aslinya) diganti balik
 * jadi "MTs" — lebih sederhana & tahan segala variasi input drpd regex per-kata. */
export function toUppercaseKeepMts(s: string): string {
  return s.toUpperCase().replace(/MTS/g, "MTs");
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
  "pklPlace", "pklSupervisor", "transferTo", "pindahanDari", "continueStudy",
] as const;

const NAME_KEYS = ["fatherName", "motherName", "guardianName"];
/** Nama sekolah/lembaga — wajib `toProperCaseSchoolName` supaya singkatan jenjang tidak rusak.
 * Sebelumnya ikut `toProperCase` polos, jadi "SMA Miftahul Ulum Kabat" tersimpan sebagai
 * "Sma Miftahul Ulum Kabat" (laporan user 29 September 2026, kolom Pindah Ke). */
const SCHOOL_KEYS = ["transferTo", "pindahanDari", "continueStudy"];
// Nomor ijazah SMP (D. Pendidikan Sebelumnya) & ijazah kelulusan (K. Kelulusan) — sama-sama kode
// resmi, sama-sama pakai toUppercaseKeepMts, BUKAN toProperCase (lihat komentar fungsi itu).
const IJAZAH_NO_KEYS = ["ijazahNo", "graduationIjazahNo"];

/** Terapkan toProperCase ke field bebas-teks dalam objek bukuIndukData (JSON), tanpa
 * menyentuh field lain (tanggal, NIK, kode, atau field dropdown yang sudah terkontrol).
 * Nama orang tua/wali pakai toProperCaseName supaya gelar akademik di belakang koma tidak diubah.
 * Nomor ijazah pakai toUppercaseKeepMts (bukan Proper Case — itu kode resmi, bukan nama). */
export function normalizeBukuIndukText<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of FREE_TEXT_BUKU_INDUK_KEYS) {
    const v = out[key];
    if (typeof v === "string" && v.trim()) {
      out[key] = NAME_KEYS.includes(key)
        ? toProperCaseName(v)
        : SCHOOL_KEYS.includes(key) ? toProperCaseSchoolName(v) : toProperCase(v);
    }
  }
  for (const key of IJAZAH_NO_KEYS) {
    const v = out[key];
    if (typeof v === "string" && v.trim()) out[key] = toUppercaseKeepMts(v);
  }
  return out as T;
}
