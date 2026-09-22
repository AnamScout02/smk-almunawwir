"use client";
import { useEffect } from "react";

/** Daftarkan service worker (public/sw.js) supaya app "installable" (PWA) — lihat sw.js untuk
 * strategi cache (network-first navigasi, cache-first asset statis). Server-only client component
 * (tidak render apapun), dipasang sekali di root layout.
 *
 * CATATAN: server saat ini HTTP polos (belum HTTPS) — browser hanya mengizinkan Service Worker di
 * origin aman (`https:` atau `localhost`). Registrasi akan diam-diam gagal (`register()` reject)
 * di HTTP produksi sampai TLS diaktifkan; manifest/icon tetap tampil & "Tambahkan ke Layar Utama"
 * tetap bisa muncul di sebagian browser (mis. Android Chrome via manifest saja), tapi caching
 * offline/instalasi penuh baru berfungsi 100% setelah HTTPS aktif. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return; // hindari error console berulang di HTTP
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
