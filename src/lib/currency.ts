/** Format angka jadi Rupiah ("Rp150.000") — dipakai modul Bendahara. Dua duplikat lokal yang
 * sudah ada (MyLibraryLoans.tsx, PerpustakaanManager.tsx) sengaja TIDAK disentuh (blast radius
 * kecil, sudah jalan) — helper ini cukup dipakai kode baru. */
export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
