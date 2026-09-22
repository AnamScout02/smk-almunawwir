/** Bagian tanggal menurut WIB. Server berjalan di UTC — `new Date().getMonth()`/`getDay()` di server memberi hari/bulan
 * KEMARIN antara pukul 00.00–07.00 WIB (CLAUDE.md #42). Aman dipakai di server maupun klien. */
export function bagianWib(d: Date = new Date()) {
  const w = new Date(d.getTime() + 7 * 3600_000);
  return {
    tahun: w.getUTCFullYear(),
    bulan: w.getUTCMonth() + 1, // 1–12
    tanggal: w.getUTCDate(),
    hariKe: w.getUTCDay(), // 0 = Minggu
    iso: w.toISOString().slice(0, 10), // "YYYY-MM-DD"
  };
}
