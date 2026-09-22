"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, ListChecks, CalendarClock, BarChart2, History, UserCircle, LogOut, Globe, Wallet, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

interface MenuItem { href: string; label: string; icon: LucideIcon; exact?: boolean }

/** Portal Bendahara — SENGAJA berdiri sendiri (bukan menu di dalam sidebar Admin/Guru), keputusan
 * eksplisit user 2026-08-28 setelah melihat panel BRI Smart Billing (yang punya sidebar/navbar
 * sendiri) — supaya staf yang jabatannya CUMA Bendahara tidak perlu menu Admin/Guru yang penuh
 * item tidak relevan. Pola dasar dicontek dari ParentSidebar.tsx TAPI mobile-nya pakai
 * MobileBottomNav (§3.6 DESIGN_SYSTEM, standar terbaru — ParentSidebar dibangun sebelum konvensi
 * ini ada, jangan dicontek untuk bagian mobile-nya). Jabatan besar lain (UKS/BK/Perpustakaan)
 * TIDAK ikut pola ini — tetap menu di sidebar Admin/Guru seperti biasa.
 *
 * 7 halaman (lewat ambang "≤5 link langsung" §3.6) — mobile jadi 4 slot link + 1 slot "Lainnya"
 * (sheet berisi Laporan Penagihan + Riwayat Aktivitas + Profil, yg paling jarang dipakai harian).
 * Desktop tetap daftar flat, tidak perlu accordion di ukuran sekecil ini. */
export default function BendaharaSidebar({ logoEmblem = "/images/logo-emblem.png" }: { logoEmblem?: string }) {
  const pathname = usePathname();

  const items: MenuItem[] = [
    { href: "/dashboard/bendahara", label: "Beranda", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/bendahara/tagihan", label: "Tagihan", icon: ClipboardList },
    { href: "/dashboard/bendahara/jenis-biaya", label: "Jenis Biaya", icon: ListChecks },
    { href: "/dashboard/bendahara/jadwal", label: "Jadwal Tagihan", icon: CalendarClock },
    { href: "/dashboard/bendahara/laporan", label: "Laporan Penagihan", icon: BarChart2 },
    { href: "/dashboard/bendahara/riwayat", label: "Riwayat Aktivitas", icon: History },
    { href: "/dashboard/bendahara/profile", label: "Profil Saya", icon: UserCircle },
  ];

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Bottom nav HP (18 Sep 2026): 4 tautan + tombol tengah Beranda, TANPA sheet.
  const navBawah: ItemNavBawah[] = [
    { href: "/dashboard/bendahara/tagihan", label: "Tagihan", icon: ClipboardList, simbol: "receipt_long" },
    { href: "/dashboard/bendahara/jadwal", label: "Jadwal", icon: CalendarClock, simbol: "calendar_month" },
    { href: "/dashboard/bendahara/laporan", label: "Laporan", icon: BarChart2, simbol: "bar_chart" },
    { href: "/dashboard/bendahara/riwayat", label: "Riwayat", icon: History, simbol: "history" },
  ];

  const nav = (
    <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-0.5">
      {items.map(item => {
        const active = isActive(item.href, item.exact);
        return (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
            <item.icon size={17} />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="px-3 py-4 border-t border-white/10 space-y-1">
      <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all">
        <Globe size={17} /> Lihat Website
      </Link>
      <form action={logout}>
        <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all">
          <LogOut size={17} /> Keluar
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop — sticky, bukan fixed (§3.4 DESIGN_SYSTEM) */}
      <aside className="hidden lg:flex flex-col w-56 bg-primary-900 h-screen sticky top-0 shrink-0 overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <Image src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" />
          <div>
            <p className="font-heading font-bold text-white text-sm">Al Munawwir</p>
            <p className="text-white/50 text-xs">Portal Bendahara</p>
          </div>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Wallet size={22} className="text-gold" />
          <span className="font-heading font-bold text-white text-sm">Portal Bendahara</span>
        </div>
        <div className="flex items-center gap-1">
          <KotakNotifikasiTombol variant="topbar" />
          <MenuAkunMobile profilHref="/dashboard/bendahara/profile" />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/bendahara", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
