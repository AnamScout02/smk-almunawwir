"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Inbox } from "lucide-react";

/** TOMBOL NOTIFIKASI — sejak 18 September 2026 hanya LENCANA + TAUTAN ke halaman `/notifikasi`
 * (Pusat Notifikasi). Sebelumnya membuka laci dari bawah; laci itu menutupi tombol tengah bottom
 * navbar dan isinya sempit, sementara pengumuman punya tempat sendiri — keputusan user: satukan
 * kabar, pengingat, dan pengumuman di satu halaman dengan pita pembeda.
 *   variant "topbar"   → ikon di bar atas mobile
 *   variant "melayang" → tombol bulat kanan-bawah khusus desktop
 * `tindakan` (pesan belum dibaca, pendaftar, dll) tetap dipakai untuk MENJUMLAH lencana; daftarnya
 * sendiri ditampilkan di halaman Pusat Notifikasi. */
export default function KotakNotifikasiTombol({ variant, ikon = "lonceng", tindakan = [] }: {
  variant: "topbar" | "melayang"; ikon?: "lonceng" | "kotak"; tindakan?: { label: string; count: number; href: string }[];
}) {
  const path = usePathname();
  const [hitung, setHitung] = useState(0);

  const muatHitung = useCallback(() => {
    fetch("/api/notifikasi?hitung=1").then(r => (r.ok ? r.json() : null)).then(d => d && setHitung(d.belumDibaca)).catch(() => {});
  }, []);

  useEffect(() => {
    muatHitung();
    const t = setInterval(muatHitung, 60_000);
    const saatTampil = () => { if (document.visibilityState === "visible") muatHitung(); };
    document.addEventListener("visibilitychange", saatTampil);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", saatTampil); };
  }, [muatHitung, path]);

  // Menuju rute portal LANGSUNG, bukan pintu `/notifikasi` (temuan user 19 Sep 2026: lewat pintu,
  // layar krem kosong di luar portal tampil beberapa detik dulu sebelum pengalihan selesai).
  // Portal di luar /dashboard tetap lewat pintu karena perannya belum tentu sama.
  const hrefNotifikasi =
    path.startsWith("/dashboard/student") ? "/dashboard/student/notifikasi"
    : path.startsWith("/dashboard/parent") ? "/dashboard/parent/notifikasi"
    : path.startsWith("/dashboard/teacher") ? "/dashboard/teacher/notifikasi"
    : path.startsWith("/dashboard/admin") || path.startsWith("/dashboard/tas") ? "/dashboard/admin/kotak-notifikasi"
    : "/notifikasi";

  const total = hitung + tindakan.reduce((a, b) => a + b.count, 0);
  const Ikon = ikon === "kotak" ? Inbox : total > 0 ? BellRing : Bell;
  const lencana = total > 0 && (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-primary-900">
      {total > 99 ? "99+" : total}
    </span>
  );

  if (variant === "melayang") {
    return (
      <Link href={hrefNotifikasi} title="Notifikasi" aria-label="Notifikasi"
        className="hidden lg:flex fixed bottom-6 right-6 z-50 h-12 w-12 items-center justify-center rounded-full bg-primary-900 text-white shadow-panel-naik ring-1 ring-primary-100 transition-transform hover:-translate-y-0.5 print:hidden">
        <span className="relative inline-flex"><Ikon size={20} />{lencana && <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{total > 99 ? "99+" : total}</span>}</span>
      </Link>
    );
  }

  return (
    <Link href={hrefNotifikasi} title="Notifikasi" aria-label="Notifikasi"
      className="relative p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
      <Ikon size={22} />
      {lencana}
    </Link>
  );
}
