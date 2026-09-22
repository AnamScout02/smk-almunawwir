/** Pembantu ALAMAT Dapodik yang boleh dipakai KLIEN maupun server. Sengaja terpisah dari
 * `src/lib/dapodik.ts` yang bertanda `server-only` (memuat prisma & kunci rahasia) — halaman
 * pengaturan perlu memecah alamat tersimpan menjadi dua kolom host & port. */

/** Port Web Service bawaan aplikasi Dapodik. */
export const PORT_DAPODIK = "5774";

/** Pecah alamat tersimpan menjadi host & port untuk dua kolom terpisah di halaman. */
export function pecahAlamatDapodik(url: string): { host: string; port: string } {
  if (!url) return { host: "", port: "" };
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port || PORT_DAPODIK };
  } catch {
    return { host: url, port: "" };
  }
}
