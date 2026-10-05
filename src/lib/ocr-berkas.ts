/** Pembaca berkas SPMB (OCR) — jalan di BROWSER pendaftar, bukan di server (2 Oktober 2026).
 *  Fungsinya MEMERIKSA ketikan, bukan mengisi formulir diam-diam: hasilnya ditampilkan sebagai
 *  "cocok / tidak cocok" dengan tombol "Pakai" yang harus ditekan sendiri — OCR bisa keliru membaca,
 *  dan KK memuat NIK seluruh anggota keluarga sehingga NIK mana milik calon tidak bisa ditebak.
 *  `tesseract.js` dimuat dinamis (hanya saat KK/ijazah diunggah), mesin & data bahasanya diambil
 *  dari CDN sekali lalu disinggahkan peramban. PDF tidak dibaca.
 *  Catatan: TANPA regex lookbehind — Safari iPhone lama gagal mengurainya (CLAUDE.md #66). */

export type HasilBaca = {
  /** Deret 16 digit (NIK / nomor KK). */
  nik: string[];
  /** Deret 10 digit (NISN). */
  nisn: string[];
  /** Tanggal yang terbaca, bentuk YYYY-MM-DD. */
  tanggal: string[];
  /** Teks mentah huruf besar — dipakai mencocokkan nama. */
  teks: string;
};

export const BISA_DIBACA = /^image\/(jpeg|png|webp)$/;

export async function bacaBerkas(file: File): Promise<HasilBaca | null> {
  if (!BISA_DIBACA.test(file.type)) return null;
  const { createWorker } = await import("tesseract.js");
  const pekerja = await createWorker("ind");
  try {
    const { data } = await pekerja.recognize(file);
    return uraiTeks(data.text ?? "");
  } finally {
    await pekerja.terminate().catch(() => {});
  }
}

const BULAN: Record<string, number> = {
  JANUARI: 1, FEBRUARI: 2, PEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6, JULI: 7,
  AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, NOPEMBER: 11, DESEMBER: 12,
};

function tgl(d: number, m: number, y: number): string | null {
  if (y < 1990 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Huruf yang lazim tertukar dengan angka oleh OCR, hanya di dalam token yang mayoritas angka. */
function angkakan(token: string): string {
  return token.replace(/[Oo]/g, "0").replace(/[IL|]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

export function uraiTeks(mentah: string): HasilBaca {
  const teks = mentah.toUpperCase();
  const nik = new Set<string>(), nisn = new Set<string>(), tanggal = new Set<string>();

  // Deret angka panjang: token tanpa spasi berisi angka & huruf mirip angka.
  for (const tok of teks.match(/[0-9OIL|SB]{10,20}/g) ?? []) {
    const jumlahAngka = (tok.match(/[0-9]/g) ?? []).length;
    if (jumlahAngka < tok.length * 0.7) continue;
    const a = angkakan(tok);
    if (/^\d{16}$/.test(a)) nik.add(a);
    else if (/^\d{10}$/.test(a)) nisn.add(a);
  }
  // NIK yang dipisah spasi tiap 4 digit (lazim di salinan KK).
  for (const m of teks.match(/\d{4}\s\d{4}\s\d{4}\s\d{4}/g) ?? []) nik.add(m.replace(/\s/g, ""));

  for (const m of teks.matchAll(/(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/g)) {
    const t = tgl(+m[1], +m[2], +m[3]); if (t) tanggal.add(t);
  }
  for (const m of teks.matchAll(/(\d{1,2})\s+([A-Z]{3,9})\s+(\d{4})/g)) {
    const b = BULAN[m[2]]; if (b) { const t = tgl(+m[1], b, +m[3]); if (t) tanggal.add(t); }
  }
  return { nik: [...nik], nisn: [...nisn], tanggal: [...tanggal], teks: teks.replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ") };
}

/** Nama dianggap terbaca bila SEMUA kata ≥3 huruf dari nama yang diketik muncul di teks berkas. */
export function namaTerbaca(nama: string, hasil: HasilBaca): boolean {
  const kata = nama.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(k => k.length >= 3);
  return kata.length > 0 && kata.every(k => hasil.teks.includes(k));
}
