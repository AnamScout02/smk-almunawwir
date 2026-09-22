import type { ItemNavPortal } from "@/components/shared/NavPortal";

/** DAFTAR MENU PORTAL DI LUAR /dashboard — satu sumber untuk bar tab layar lebar, bottom navbar HP,
 * dan kisi "Menu Portal" di beranda portal (18 September 2026). Data polos (ikon berupa NAMA), jadi
 * aman dioper dari halaman server ke komponen klien (CLAUDE.md #35). */

export const MENU_PUSAT_PERPUSTAKAAN: ItemNavPortal[] = [
  { href: "/pusat-perpustakaan", label: "Beranda", ikon: "beranda", persis: true },
  { href: "/pusat-perpustakaan/sirkulasi", label: "Meja Sirkulasi", singkat: "Sirkulasi", ikon: "sirkulasi" },
  { href: "/pusat-perpustakaan/kunjungan", label: "Kiosk Kunjungan", singkat: "Kunjungan", ikon: "kunjungan" },
  { href: "/pusat-perpustakaan/kelola", label: "Katalog & Data", singkat: "Katalog", ikon: "kelola" },
  { href: "/pusat-perpustakaan/laporan", label: "Laporan", ikon: "laporan" },
  { href: "/pusat-perpustakaan/usulan", label: "Usulan Buku", singkat: "Usulan", ikon: "usulan" },
  { href: "/pusat-perpustakaan/stok-opname", label: "Stok Opname", singkat: "Opname", ikon: "opname" },
  { href: "/pusat-perpustakaan/peringkat", label: "Peringkat", ikon: "peringkat" },
];

export const MENU_PUSAT_UJIAN: ItemNavPortal[] = [
  { href: "/pusat-ujian", label: "Daftar Ujian", singkat: "Ujian", ikon: "ujian" },
  { href: "/pusat-ujian/kendali", label: "Ruang Kendali", singkat: "Kendali", ikon: "kendali" },
  { href: "/pusat-ujian/rekap-nilai", label: "Rekap Nilai", singkat: "Rekap", ikon: "rekap" },
  { href: "/pusat-ujian/administrasi", label: "Administrasi", ikon: "administrasi" },
  { href: "/pusat-ujian/panduan", label: "Panduan", ikon: "panduan" },
  { href: "/pusat-ujian/pengaturan", label: "Pengaturan Ujian", singkat: "Pengaturan", ikon: "pengaturan" },
  { href: "/pusat-ujian/data", label: "Cadangan & Hapus Data", singkat: "Data", ikon: "data" },
];

export function menuPerpustakaanAnggota(petugas: boolean): ItemNavPortal[] {
  return [
    { href: "/perpustakaan", label: "Katalog", ikon: "katalog", persis: true },
    { href: "/perpustakaan/pinjaman", label: "Pinjaman Saya", singkat: "Pinjaman", ikon: "pinjaman" },
    { href: "/perpustakaan/kartu", label: "Kartu Anggota", singkat: "Kartu", ikon: "kartu" },
    { href: "/perpustakaan/usulan", label: "Usulan Buku", singkat: "Usulan", ikon: "usulan" },
    { href: "/perpustakaan/peringkat", label: "Peringkat", ikon: "peringkat" },
    ...(petugas ? [{ href: "/pusat-perpustakaan", label: "Pusat Perpustakaan", singkat: "Pusat", ikon: "kelola" as const }] : []),
  ];
}
