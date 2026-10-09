import type { MetadataRoute } from "next";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** robots.txt (7 Okt 2026) — dulu sitemap menunjuk domain yang SALAH (`smk-almunawwir.sch.id`, tertulis mati). Alamat
 *  sekarang dari ALAMAT_APLIKASI. Yang ditutup: portal & halaman berisi data pribadi/token (tahapan calon, verifikasi QR,
 *  papan TV, presensi, aset) — semuanya tidak berguna di hasil pencarian dan sebagian memuat data calon/siswa. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/", "/api/", "/login", "/pusat-", "/spmb/", "/verify/", "/layar", "/hadir/", "/aset/",
          "/ujian-online", "/perpustakaan", "/kartu-identitas", "/notifikasi", "/pengumuman", "/survei",
          "/layanan-sarpras", "/masukan-rekan", "/penilaian-pkl", "/tamu", "/seb-", "/pemeliharaan", "/daftar-ulang",
        ],
      },
    ],
    sitemap: `${ALAMAT_APLIKASI}/sitemap.xml`,
    host: ALAMAT_APLIKASI,
  };
}
