"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** TOMBOL "KEMBALI" BAKU (24 September 2026 — permintaan user: "cek halaman yang tidak punya tombol kembali, buat sama semua").
 *
 * Wajib ada di setiap halaman yang TIDAK bisa dicapai dari menu sidebar: halaman anak (dibuka dari
 * kartu/tautan halaman lain), halaman cetak, dan halaman yang dibuka dari lonceng/QR. Halaman yang ADA di
 * menu tidak perlu — menunya sendiri sudah jadi jalan pulang.
 *
 * Satu bentuk untuk semua: `btn-modal-cancel` + panah kiri + kata "Kembali" (DESIGN_SYSTEM §4.1), diletakkan
 * pada BARIS SENDIRI tepat di bawah `PageHeader`. Tanpa `href` tombol memakai riwayat browser — dipakai bila
 * asal halaman bisa berbeda-beda (mis. detail aset yang dibuka dari pindai QR label). */
export default function TombolKembali(
  { href, onClick, className = "" }: { href?: string; onClick?: () => void; className?: string },
) {
  const router = useRouter();
  const kelas = `btn-modal-cancel ${className}`.trim();
  if (href) return <Link href={href} className={kelas}><ArrowLeft /> Kembali</Link>;
  // `onClick` untuk "kembali" yang MENUTUP tampilan di halaman yang sama (mis. keluar dari rekap ke daftar),
  // bukan berpindah halaman. Tetap lewat komponen ini supaya bentuknya tidak pernah menyimpang sendiri.
  return <button type="button" onClick={onClick ?? (() => router.back())} className={kelas}><ArrowLeft /> Kembali</button>;
}

/** Baris pembungkusnya — pakai ini supaya jarak & posisinya sama di semua halaman. */
export function BarisKembali({ href }: { href?: string }) {
  // `print:hidden` di WADAHNYA: tombol tidak pernah ikut tercetak, dan karena display:none ia juga tidak
  // menyisakan ruang kosong di kertas (DESIGN_SYSTEM §10 / CLAUDE.md #25).
  return <div className="flex mb-5 print:hidden"><TombolKembali href={href} /></div>;
}
