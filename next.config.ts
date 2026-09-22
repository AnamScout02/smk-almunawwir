import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [],
    // Optimasi gambar dihidupkan penuh (18 Sep 2026): logo sekolah & logo jurusan yang diunggah
    // berukuran 240 KB–4,5 MB dan dulu dirender `unoptimized`, sehingga tiap halaman mengunduh
    // berkas aslinya (thumbnail 36px pun ikut). Lewat pengoptimal Next ukurannya turun belasan kali.
    // SVG diizinkan TAPI disandbox + tanpa skrip, karena unggahan hanya dari admin.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 2592000,
  },
};

export default nextConfig;
