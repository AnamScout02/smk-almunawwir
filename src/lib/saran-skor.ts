/** SARAN SKOR URAIAN (21 September 2026) — permintaan user: "server bisa membandingkan jawaban siswa dengan acuan,
 * menyorot bagian yang cocok, dan menyarankan skor. Guru tinggal menyetujui."
 *
 * Murni (tanpa basis data, tanpa layanan berbayar) — berjalan di browser guru saat mengoreksi. Cara kerja:
 *   1. JAWABAN ACUAN (`kunci.acuan`) dipecah jadi POIN (baris, titik-koma, butir bernomor, atau kalimat).
 *   2. Tiap poin → kata kunci (kata isi setelah membuang kata umum & imbuhan sederhana). Kata yang SUDAH ADA di soal tidak
 *      dihitung — siswa yang hanya menyalin soal tidak mendapat skor.
 *   3. Cakupan poin = kata kunci yang muncul di jawaban siswa (toleran imbuhan & salah ketik 1 huruf) + bonus frasa.
 *   4. Bobot poin dari angka dalam kurung di PEDOMAN PENSKORAN bila jumlahnya sama dengan jumlah poin, selain itu rata.
 * Hasilnya SARAN — guru tetap memutuskan dan menyimpan. Jawaban yang benar dengan kata-kata sendiri (sinonim) bisa
 * mendapat saran lebih rendah dari semestinya; itu sebabnya tidak pernah disimpan otomatis. */

const KATA_UMUM = new Set((
  "yang dan di ke dari untuk dengan adalah ialah itu ini pada dalam atau juga akan oleh sebagai karena sehingga maka bahwa " +
  "agar supaya jika kalau bila apabila namun tetapi tapi serta lalu kemudian setelah sebelum saat ketika sudah telah belum " +
  "masih bisa dapat harus perlu ada tidak bukan tak ya saja pun lah kah nya se para sang si kita kami saya aku kamu anda " +
  "dia ia mereka beliau hal cara secara sangat lebih paling agak cukup banyak sedikit semua setiap tiap beberapa satu dua " +
  "tiga pertama kedua ketiga merupakan yaitu yakni misalnya contoh seperti antara lain dll dsb dst jadi hanya begitu " +
  "demikian tersebut tentang terhadap kepada bagi oleh hingga sampai sejak selama tanpa melalui menurut atas bawah"
).split(/\s+/));

const normal = (t: string) => t.toLowerCase().replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const kata = (t: string) => normal(t).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];

/** Pemotong imbuhan SANGAT sederhana — sama di kedua sisi, jadi cukup untuk mencocokkan. */
export function akar(w: string): string {
  let s = w.replace(/-.*$/, "");
  if (/^\d+$/.test(s)) return s;
  if (s.length > 5) s = s.replace(/(lah|kah|pun)$/, "");
  if (s.length > 5) s = s.replace(/(nya|ku|mu)$/, "");
  if (s.length > 6) s = s.replace(/(kan|an)$/, "");
  else if (s.length > 5) s = s.replace(/an$/, "");
  const tanpa = s.replace(/^(meng|meny|mem|men|me|peng|peny|pem|pen|pe|ber|be|ter|di|ke|se)/, "");
  return tanpa.length >= 4 ? tanpa : s;
}

function jarak1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, beda = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++beda > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return beda + (a.length - i) + (b.length - j) <= 1;
}
/** Dua akar dianggap sama: identik, salah satu akhiran yang lain (sisa imbuhan luluh: "ulis"/"tulis"), atau beda 1 huruf. */
export function akarSama(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a))) return true;
  return Math.min(a.length, b.length) >= 6 && jarak1(a, b);
}

const kataIsi = (t: string) => kata(t).filter(w => !KATA_UMUM.has(w) && (w.length > 2 || /^\d+$/.test(w)));

/** Pecah jawaban acuan jadi poin. */
export function poinAcuan(acuan: string): string[] {
  const t = acuan.replace(/\r/g, "").trim();
  if (!t) return [];
  let bagian = t.split(/\n+|;|(?:^|\s)\d+[).]\s+/).map(x => x.trim()).filter(Boolean);
  // Tanpa lookbehind — Safari iPhone lama gagal mengurai lookbehind dan seluruh halaman ikut rusak.
  if (bagian.length <= 1) bagian = t.replace(/([.!?])\s+/g, "$1\n").split("\n").map(x => x.trim()).filter(Boolean);
  return bagian.filter(b => kataIsi(b).length > 0);
}

export interface SaranSkor {
  skor: number;
  persen: number;
  poin: { teks: string; bobot: number; cakupan: number }[];
  /** Akar kata jawaban siswa yang cocok — untuk menyorot. */
  cocok: Set<string>;
  pendek: boolean;
}

export function saranSkor(o: { jawaban: unknown; acuan?: string | null; rubrik?: string | null; pertanyaan?: string | null; skorMaks: number }): SaranSkor | null {
  if (typeof o.jawaban !== "string" || !o.acuan?.trim() || o.skorMaks <= 0) return null;
  const poin = poinAcuan(o.acuan);
  if (!poin.length) return null;
  const akarSoal = new Set(kataIsi(o.pertanyaan ?? "").map(akar));
  const akarSiswa = [...new Set(kataIsi(o.jawaban).map(akar))];
  const pasangSiswa = new Set(kataIsi(o.jawaban).map(akar).map((w, i, a) => (i ? `${a[i - 1]} ${w}` : "")).filter(Boolean));

  const bobotRubrik = [...(o.rubrik ?? "").matchAll(/\((\d+(?:[.,]\d+)?)\)/g)].map(m => Number(m[1].replace(",", ".")));
  const bobot = bobotRubrik.length === poin.length ? bobotRubrik : poin.map(() => 1);
  const cocok = new Set<string>();
  const hasil = poin.map((teks, i) => {
    const semua = [...new Set(kataIsi(teks).map(akar))];
    const kunci = semua.filter(w => ![...akarSoal].some(s => akarSama(s, w)));
    const dipakai = kunci.length ? kunci : semua; // poin yang seluruh katanya ada di soal tetap dinilai
    let kena = 0;
    for (const w of dipakai) {
      const t = akarSiswa.find(s => akarSama(s, w));
      if (t) { kena++; cocok.add(t); }
    }
    const urut = kataIsi(teks).map(akar);
    let frasa = 0;
    for (let k = 1; k < urut.length; k++) if (pasangSiswa.has(`${urut[k - 1]} ${urut[k]}`)) frasa++;
    const cakupan = Math.min(1, kena / dipakai.length + frasa * 0.1);
    return { teks, bobot: bobot[i], cakupan: Math.round(cakupan * 100) / 100 };
  });
  const total = hasil.reduce((n, p) => n + p.bobot, 0) || 1;
  // Mengenai ±75% kata kunci sebuah poin sudah dianggap poin itu terpenuhi.
  const persenMentah = hasil.reduce((n, p) => n + p.bobot * Math.min(1, p.cakupan / 0.75), 0) / total;
  const pendek = kataIsi(o.jawaban).length < 3;
  const persen = pendek ? 0 : Math.round(persenMentah * 100);
  return { skor: Math.round(((persen / 100) * o.skorMaks) * 2) / 2, persen, poin: hasil, cocok, pendek };
}

/** Potong jawaban siswa jadi bagian bertanda (untuk menyorot kata yang cocok dengan acuan). */
export function sorotJawaban(jawaban: string, cocok: Set<string>): { teks: string; kena: boolean }[] {
  return jawaban.split(/([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/).filter(x => x !== "").map(teks => {
    const w = teks.toLowerCase();
    const kena = /^[a-z0-9]/.test(w) && !KATA_UMUM.has(w) && [...cocok].some(c => akarSama(c, akar(w)));
    return { teks, kena };
  });
}
