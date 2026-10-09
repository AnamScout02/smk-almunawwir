/** PENGENAL JENIS DOKUMEN (8 Oktober 2026) — murni, memakai teks yang SUDAH dibaca OCR di peramban
 *  (src/lib/ocr-berkas.ts), jadi tidak ada model atau unduhan tambahan.
 *
 *  Tujuannya menegur calon yang salah kotak (KK diunggah di kotak ijazah) SEBELUM formulir terkirim —
 *  sekarang kesalahan itu baru ketahuan saat panitia memverifikasi, dan calon harus mengunggah ulang.
 *
 *  Hasilnya DUGAAN: OCR foto HP sering salah baca, jadi satu jenis baru disebut bila kata kuncinya
 *  cukup banyak DAN jelas mengungguli jenis lain; selain itu null ("tidak tahu") dan tidak ada teguran.
 *  Unggahan tidak pernah ditolak karena dugaan ini. */

export type JenisDokumen = "kk" | "ktp" | "ijazah" | "akta";

export const NAMA_JENIS: Record<"id" | "en", Record<JenisDokumen | "foto", string>> = {
  id: { kk: "Kartu Keluarga", ktp: "KTP", ijazah: "ijazah / surat keterangan lulus", akta: "akta kelahiran", foto: "pas foto" },
  en: { kk: "a Family Card (KK)", ktp: "an ID card (KTP)", ijazah: "a diploma / graduation certificate", akta: "a birth certificate", foto: "a portrait photo" },
};

/** [frasa, bobot] — bobot 3 = judul dokumen (hampir pasti), 1 = isian yang lazim ada di dokumen itu. */
const KATA_KUNCI: Record<JenisDokumen, [string, number][]> = {
  kk: [
    ["KARTU KELUARGA", 3], ["KEPALA KELUARGA", 2], ["STATUS HUBUNGAN DALAM KELUARGA", 2], ["NAMA ORANG TUA", 1],
    ["DOKUMEN IMIGRASI", 1], ["JENIS PEKERJAAN", 1], ["TANGGAL PERKAWINAN", 1], ["KODE POS", 1],
  ],
  ktp: [
    ["BERLAKU HINGGA", 2], ["SEUMUR HIDUP", 2], ["GOL DARAH", 1], ["KEL DESA", 1], ["TEMPAT TGL LAHIR", 2],
    ["STATUS PERKAWINAN", 1], ["KEWARGANEGARAAN", 1], ["KARTU TANDA PENDUDUK", 3],
  ],
  ijazah: [
    ["IJAZAH", 3], ["SURAT KETERANGAN LULUS", 3], ["SEKOLAH MENENGAH PERTAMA", 2], ["MADRASAH TSANAWIYAH", 2],
    ["DINYATAKAN LULUS", 2], ["NOMOR INDUK SISWA NASIONAL", 2], ["SATUAN PENDIDIKAN", 1], ["TAHUN PELAJARAN", 1],
    ["TAHUN AJARAN", 1], ["KEPALA SEKOLAH", 1], ["KEPALA MADRASAH", 1],
  ],
  akta: [
    ["KUTIPAN AKTA KELAHIRAN", 3], ["AKTA KELAHIRAN", 2], ["PENCATATAN SIPIL", 1], ["TELAH LAHIR", 2], ["ANAK KE", 1],
  ],
};

/** Satu huruf boleh meleset pada kata ≥5 huruf — OCR lazim menukar I/L, O/0, atau menelan satu huruf. */
function mirip(a: string, b: string): boolean {
  if (a === b) return true;
  if (b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, beda = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++beda > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return beda + (a.length - i) + (b.length - j) <= 1;
}

function adaFrasa(kata: string[], frasa: string[]): boolean {
  for (let i = 0; i + frasa.length <= kata.length; i++) {
    let cocok = true;
    for (let j = 0; j < frasa.length; j++) if (!mirip(kata[i + j], frasa[j])) { cocok = false; break; }
    if (cocok) return true;
  }
  return false;
}

export function skorJenis(teks: string): Record<JenisDokumen, number> {
  const kata = teks.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  const skor = { kk: 0, ktp: 0, ijazah: 0, akta: 0 } as Record<JenisDokumen, number>;
  for (const j of Object.keys(KATA_KUNCI) as JenisDokumen[]) {
    for (const [frasa, bobot] of KATA_KUNCI[j]) if (adaFrasa(kata, frasa.split(" "))) skor[j] += bobot;
  }
  // KK memuat sebagian isian KTP (status perkawinan, kewarganegaraan) untuk tiap anggota keluarga.
  if (skor.kk >= 3) skor.ktp = Math.max(0, skor.ktp - 2);
  // "Akta kelahiran" juga disebut di KK (kolom nomor akta) — judul lengkapnya saja yang menentukan.
  if (skor.kk >= 3 && skor.akta < 3) skor.akta = 0;
  return skor;
}

/** Jenis dokumen yang terbaca, atau null bila tidak cukup yakin. */
export function kenaliJenis(teks: string): JenisDokumen | null {
  const skor = skorJenis(teks);
  const urut = (Object.entries(skor) as [JenisDokumen, number][]).sort((a, b) => b[1] - a[1]);
  const [j1, s1] = urut[0], s2 = urut[1][1];
  return s1 >= 3 && s1 >= s2 + 2 ? j1 : null;
}

/** Jenis yang SEHARUSNYA ada di tiap kotak unggah baku. Kotak lain (dokumen lain, syarat tambahan) tidak diperiksa. */
export const JENIS_KOTAK: Record<string, JenisDokumen> = { ijazah: "ijazah", kk: "kk", ktp_wali: "ktp" };

/** Berkas salah kotak? Mengembalikan jenis yang terbaca bila BERBEDA dari yang diminta kotak itu. */
export function salahKotak(kotak: string, teks: string): JenisDokumen | null {
  const harus = JENIS_KOTAK[kotak];
  if (!harus) return null;
  const terbaca = kenaliJenis(teks);
  return terbaca && terbaca !== harus ? terbaca : null;
}
