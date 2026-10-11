"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Printer, CalendarDays, ShieldAlert, CalendarClock, Bell, UserCircle, LogOut, Globe, ChevronDown, FileText, GraduationCap, CalendarX, ClipboardPen, HeartPulse, CircleHelp, MessagesSquare, LayoutGrid, Briefcase } from "lucide-react";
import { CalendarX2, Flag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

interface MenuItem { href: string; label: string; icon: LucideIcon; exact?: boolean }
interface MenuGroup { label: string | null; items: MenuItem[] }

interface SidebarContentProps {
  logoEmblem: string;
  logoFullWhite?: string;
  filteredGroups: MenuGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
}

// Komponen TERPISAH di luar ParentSidebar — pola sama persis StudentSidebar.tsx (mencegah React
// membongkar-pasang ulang seluruh sidebar tiap render parent kalau didefinisikan di dalam body).
function SidebarContent({ logoEmblem, logoFullWhite, filteredGroups, openGroups, toggleGroup, isActive }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/10">
        {logoFullWhite ? (
          <div className="flex flex-col gap-1.5">
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Portal Orang Tua</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Image src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
            <div>
              <p className="font-heading font-bold text-white text-sm">Al Munawwir</p>
              <p className="text-white/50 text-xs">Portal Orang Tua</p>
            </div>
          </div>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-1">
        {filteredGroups.map(group => {
          const isRoot = group.label === null;
          const isOpen = isRoot || openGroups.has(group.label!);
          return (
            <div key={group.label ?? "__root__"} className={isRoot ? "" : "pt-2"}>
              {group.label && (
                <button type="button" onClick={() => toggleGroup(group.label!)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-bold tracking-wider text-white/30 hover:text-white/60 uppercase transition-colors text-left">
                  <span>{group.label}</span>
                  <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const active = isActive(item.href, item.exact);
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                        <item.icon size={17} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
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
    </div>
  );
}

interface ParentSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  /** Admin sedang "Masuk Sebagai" akun ini — topbar mobile digeser turun supaya tidak ketutup
   * pita ImpersonationBanner. Lihat catatan sama di StudentSidebar.tsx/TeacherSidebar.tsx. */
  impersonating?: boolean;
  tindakan?: { label: string; count: number; href: string }[];
}

/** Portal Orang Tua. Mobile memakai MobileBottomNav + MenuAkunMobile seperti portal lain (§3.6
 * DESIGN_SYSTEM) — sampai 14 September 2026 portal ini satu-satunya yang masih memakai hamburger+drawer. */
const GRUP_ORTU: MenuGroup[] = [
    {
      label: null,
      items: [{ href: "/dashboard/parent", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Perkembangan Anak",
      items: [
        { href: "/dashboard/parent/jadwal", label: "Jadwal Pelajaran", icon: CalendarClock },
        { href: "/dashboard/parent/absensi", label: "Absensi", icon: CalendarDays },
        { href: "/dashboard/parent/kegiatan-tidak-ikut", label: "Tidak Ikut Kegiatan", icon: CalendarX2 },
        { href: "/dashboard/parent/izin", label: "Ajukan Izin / Sakit", icon: CalendarX },
        { href: "/dashboard/parent/poin", label: "Poin Kedisiplinan", icon: ShieldAlert },
        { href: "/dashboard/parent/kesehatan", label: "Kesehatan (UKS)", icon: HeartPulse },
        { href: "/dashboard/parent/konseling", label: "Janji Temu Sekolah", icon: MessagesSquare },
        { href: "/dashboard/parent/pkl", label: "PKL Anak", icon: Briefcase },
        { href: "/dashboard/parent/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag },
        { href: "/dashboard/parent/rapor", label: "Rapor & Nilai", icon: Printer },
      ],
    },
    {
      label: "Informasi",
      items: [
        { href: "/dashboard/parent/pengumuman", label: "Pengumuman", icon: Bell },
        { href: "/dashboard/parent/survei", label: "Survei & Angket", icon: ClipboardPen },
        { href: "/bantuan", label: "Pusat Bantuan", icon: CircleHelp },
      ],
    },
    {
      label: "Akun Saya",
      items: [
        { href: "/dashboard/parent/permintaan-surat", label: "Permintaan Surat", icon: FileText },
        { href: "/dashboard/parent/profile", label: "Profil Saya", icon: UserCircle },
      ],
    },
  ];

/** SATU SUMBER menu Portal Orang Tua — sidebar desktop, bottom nav HP, dan kisi "Semua Menu". */
export function grupMenuOrtu(): MenuGroup[] {
  return GRUP_ORTU;
}

export default function ParentSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, impersonating = false, tindakan = [] }: ParentSidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const menuGroups = GRUP_ORTU;

  const visibleGroups = menuGroups.filter(g => g.items.length > 0);
  const ALL_HREFS = visibleGroups.flatMap(g => g.items.map(i => i.href));

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    if (pathname !== href && !pathname.startsWith(href + "/")) return false;
    const moreSpecific = ALL_HREFS.some(h => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + "/")));
    return !moreSpecific;
  }

  function activeGroupLabel(): string | null {
    for (const g of visibleGroups) {
      if (!g.label) continue;
      if (g.items.some(item => isActive(item.href, !!item.exact))) return g.label;
    }
    return null;
  }

  // Semua grup tertutup di awal login/muat halaman kecuali grup halaman aktif — sengaja tidak ada
  // restore dari localStorage (keputusan eksplisit user, sama seperti sidebar Admin/TAS/Guru/Siswa).
  useEffect(() => {
    const active = activeGroupLabel();
    setOpenGroups(active ? new Set([active]) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const active = activeGroupLabel();
    if (!active) return;
    setOpenGroups(new Set([active]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => (prev.has(label) ? new Set<string>() : new Set([label])));
  }

  // Bottom nav HP (18 Sep 2026): 4 tautan harian + tombol tengah Dashboard, TANPA sheet.
  const navBawah: ItemNavBawah[] = [
    { href: "/dashboard/parent/absensi", label: "Absensi", icon: CalendarDays, simbol: "event_available" },
    { href: "/dashboard/parent/izin", label: "Izin", icon: CalendarX, simbol: "event_busy" },
    { href: "/dashboard/parent/rapor", label: "Rapor", icon: Printer, simbol: "description" },
    { href: "/dashboard/parent/pengumuman", label: "Info", icon: Bell, simbol: "campaign" },
  ];

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-primary-900 h-screen sticky top-0 shrink-0 overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "226.27px 226.27px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent
          logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
          filteredGroups={visibleGroups} openGroups={openGroups} toggleGroup={toggleGroup}
          isActive={isActive}
        />
      </aside>
      <div className="lg:hidden print:hidden fixed left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg"
        style={impersonating ? { top: "var(--impersonation-banner-h, 2.5rem)" } : { top: 0 }}>
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" unoptimized />
          ) : (
            <>
              <Image src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
              <span className="font-heading font-bold text-white text-sm">Portal Orang Tua</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <KotakNotifikasiTombol variant="topbar" tindakan={tindakan} />
          <MenuAkunMobile profilHref="/dashboard/parent/profile" />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/parent", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
