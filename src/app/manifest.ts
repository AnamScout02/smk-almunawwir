import type { MetadataRoute } from "next";
import { versiIkon } from "@/lib/ikon-aplikasi";

// WAJIB dinamis: manifest.ts di-cache statis saat build kecuali memakai konfigurasi dinamis — tanpa ini
// versi ikon membeku dengan logo bawaan dan penggantian Logo Lambang tidak pernah sampai ke aplikasi terpasang.
export const dynamic = "force-dynamic";

// PWA manifest — Next.js 16 file convention, auto ter-link ke <head> (tidak perlu <link> manual di
// layout.tsx). Warna & nama ikut token desain resmi (navy #0F1A45) — lihat DESIGN_SYSTEM.md §2.
//
// IKON (14 September 2026, permintaan eksplisit user "logonya pakai logo yang bundar", "di database kita
// sudah ada logo itu"): dibangkitkan dari Logo Lambang (`logo.emblem`) oleh /ikon-aplikasi/[berkas] —
// MEMBALIK keputusan 2026-08-23 yang memakai lambang kufic tanpa cincin tulisan (logo-mark.png). `?v=`
// = versi logo, jadi ikon aplikasi terpasang ikut berganti saat logo diganti. Cara pembuatannya lihat
// src/lib/ikon-aplikasi.ts. `favicon.png` situs SENGAJA TIDAK diganti.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const v = await versiIkon().catch(() => "bawaan");
  const ikon = (berkas: string) => `/ikon-aplikasi/${berkas}?v=${v}`;
  return {
    id: "/",
    // Nama aplikasi dipilih user 23 September 2026 ("Alwis" = julukan sekolah); short_name dipakai di
    // layar utama HP sehingga sengaja pendek (label panjang dipotong sekitar 10–12 huruf oleh Android).
    name: "MyAlwis Mobile — SMK Al Munawwir IIBS",
    short_name: "MyAlwis",
    description:
      "Sistem manajemen akademik SMK Al Munawwir International Islamic Boarding School — nilai, absensi, jadwal, ujian, dan rapor.",
    // BUKAN "/dashboard" polos — halaman itu TIDAK PERNAH ADA (cuma ada /dashboard/admin,
    // /dashboard/teacher, /dashboard/student, /dashboard/parent — masing2 role beda folder,
    // tidak ada index bersama), jadi selalu 404 (bug nyata, temuan user via screenshot
    // 2026-08-24 — install app dari home screen langsung buka 404). "/login" aman utk SEMUA
    // kondisi: proxy.ts sudah punya logic roleRedirect KHUSUS utk path ini (kalau sesi login
    // masih valid, otomatis dialihkan ke dashboard sesuai role; kalau belum/sudah kadaluarsa,
    // tampil form login biasa) — jangan ganti ke "/dashboard" lagi tanpa bikin dulu
    // src/app/dashboard/page.tsx yang benar2 ada.
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#F8F7F2",
    theme_color: "#0F1A45",
    // SENGAJA tanpa `orientation`. Dulu "portrait-primary": jendela aplikasi terpasang di laptop/desktop
    // dan tablet ikut dipaksa potret. Biarkan mengikuti perangkat.
    lang: "id",
    categories: ["education"],
    icons: [
      { src: ikon("any-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: ikon("any-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: ikon("maskable-192.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: ikon("maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
