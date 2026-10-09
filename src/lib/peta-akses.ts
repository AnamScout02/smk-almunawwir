/** Siapa boleh membuka PETA SEBARAN di luar Pusat SPMB (8 Oktober 2026, permintaan user: "fitur ini juga tidak cuman
 *  di spmb saja"). NETRAL — dipakai penjaga server (peta-guard.ts) DAN sidebar/menu supaya daftarnya tidak pernah
 *  berbeda. Peta hanya berisi JUMLAH per wilayah (tanpa nama), tetapi sampai tingkat desa — jadi tetap dibatasi ke
 *  pimpinan & bidang yang memakainya: kesiswaan/BK (asal siswa), humas/BKK (alumni), branding (sasaran promosi). */
export const JABATAN_PETA = [
  "Kepala Sekolah",
  "Wakil Kepala Kesiswaan",
  "Wakil Kepala Humas",
  "Wakil Kepala Kurikulum",
  "Wakil Kepala Bidang Penjamin Mutu",
  "Koordinator BKK",
  "Guru BK",
  "Operator Sekolah",
  "Koordinator Tim Branding & Publikasi",
  "Tim Branding & Publikasi",
];
