import { redirect } from "next/navigation";

/** Halaman lama — pengelolaan perpustakaan sudah pindah ke portal Pusat Perpustakaan (CLAUDE.md #34). Dialihkan supaya
 * markah & tautan lama tetap berfungsi. Halaman cetak-barcode di bawahnya TETAP dipakai (ditautkan PerpustakaanManager). */
export default function AdminPerpustakaanPage() {
  redirect("/pusat-perpustakaan/kelola");
}
