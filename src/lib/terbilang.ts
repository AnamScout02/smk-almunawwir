/** Terbilang bahasa Indonesia untuk bilangan bulat 0 – 999.999.999.999 (kuitansi, surat).
 *  NETRAL — bisa dipakai server maupun klien. `terbilang` lama di administrasi-ujian.ts hanya sampai 9.999. */
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function ratusan(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh${n % 10 ? " " + SATUAN[n % 10] : ""}`;
  if (n < 200) return `seratus${n % 100 ? " " + ratusan(n % 100) : ""}`;
  return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? " " + ratusan(n % 100) : ""}`;
}

export function terbilangAngka(nilai: number): string {
  let n = Math.floor(Math.abs(nilai));
  if (n === 0) return "nol";
  const tingkat = ["", "ribu", "juta", "miliar"];
  const bagian: string[] = [];
  for (let i = 0; n > 0 && i < tingkat.length; i++) {
    const r = n % 1000;
    if (r) bagian.unshift(i === 1 && r === 1 ? "seribu" : `${ratusan(r)}${tingkat[i] ? " " + tingkat[i] : ""}`);
    n = Math.floor(n / 1000);
  }
  return bagian.join(" ").replace(/\s+/g, " ").trim();
}

/** "Satu Juta Lima Ratus Ribu Rupiah" — huruf kapital tiap kata seperti lazimnya di kuitansi. */
export function terbilangRupiah(nilai: number): string {
  return (terbilangAngka(nilai) + " rupiah").replace(/\b\w/g, c => c.toUpperCase());
}
