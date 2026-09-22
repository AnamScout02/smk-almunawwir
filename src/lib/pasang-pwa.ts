/** Tawaran pasang aplikasi (PWA) dari browser, dipakai bersama banner `InstallPwaPrompt` dan halaman
 * `/pasang-aplikasi`.
 *
 * Chrome/Edge memicu `beforeinstallprompt` SEKALI per muat halaman, sering sebelum komponen React selesai
 * hydrate. Dulu banner baru memasang pendengar di dalam useEffect — kalau event datang lebih dulu,
 * tawaran pasang hilang dan tombol Pasang tidak pernah muncul. Pendengar di sini dipasang saat modul
 * dimuat (lebih awal dari effect mana pun), event disimpan, lalu komponen berlangganan.
 *
 * Safari (iPhone/iPad/Mac) tidak punya event ini sama sekali — pemasangan di sana selalu manual lewat
 * tombol Bagikan → "Tambahkan ke Layar Utama"; tampilkan petunjuknya, jangan tombol. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let tertunda: BeforeInstallPromptEvent | null = null;
let baruTerpasang = false;
const pelanggan = new Set<() => void>();
const kabari = () => pelanggan.forEach(f => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    tertunda = e as BeforeInstallPromptEvent;
    kabari();
  });
  window.addEventListener("appinstalled", () => {
    tertunda = null;
    baruTerpasang = true;
    kabari();
  });
}

/** Browser sedang menawarkan pemasangan (tombol Pasang boleh ditampilkan). */
export const bisaDipasang = () => tertunda !== null;

export function langganPasang(f: () => void) {
  pelanggan.add(f);
  return () => { pelanggan.delete(f); };
}

/** Tampilkan dialog pasang bawaan browser. Event hanya bisa dipakai sekali. */
export async function pasangSekarang(): Promise<"accepted" | "dismissed" | "tidak-tersedia"> {
  const e = tertunda;
  if (!e) return "tidak-tersedia";
  tertunda = null;
  kabari();
  await e.prompt();
  return (await e.userChoice).outcome;
}

/** Halaman sedang berjalan sebagai aplikasi terpasang (jendela sendiri), atau baru saja dipasang. */
export function sudahTerpasang() {
  if (typeof window === "undefined") return false;
  return baruTerpasang
    || window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
