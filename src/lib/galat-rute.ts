/** `verifyRole`/`verifySession` menolak dengan REDIRECT Next.js, yang di route API dilempar sebagai galat
 * ber-`digest` "NEXT_REDIRECT". Kalau galat itu tertelan `catch` umum, pemanggil yang belum masuk menerima
 * **500** alih-alih dialihkan ke halaman masuk — log galat jadi penuh kejadian palsu dan masalah asli
 * tersamar (temuan audit CBT 24 September 2026).
 *
 * Panggil di BARIS PERTAMA tiap `catch` route: pengalihan diteruskan apa adanya, galat lain ditangani biasa. */
export function lemparBilaPengalihan(galat: unknown): void {
  const d = (galat as { digest?: unknown } | null)?.digest;
  if (typeof d === "string" && (d.startsWith("NEXT_REDIRECT") || d === "NEXT_NOT_FOUND")) throw galat;
}
