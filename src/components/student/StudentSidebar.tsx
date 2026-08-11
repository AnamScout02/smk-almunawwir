"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Printer, IdCard, UserCircle, LogOut, Menu, X, Globe, Briefcase, BookOpen, CheckSquare, FileQuestion, Trophy, ShieldAlert, BookOpenCheck, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";

interface MenuItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number; badgeKey?: "pendingBiodata" }
interface MenuGroup { label: string | null; items: MenuItem[] }

interface SidebarContentProps {
  logoEmblem: string;
  logoFullWhite?: string;
  filteredGroups: MenuGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
  hasPendingBiodata: boolean;
  onLinkClick: () => void;
}

// Komponen TERPISAH di luar StudentSidebar — lihat komentar lengkap di AdminSidebar.tsx (kalau
// didefinisikan di dalam body, React membongkar-pasang ulang seluruh sidebar tiap render parent).
// PERBAIKAN 2026-08-11 (keputusan eksplisit user) — dikelompokkan + accordion, sama seperti
// AdminSidebar/TasSidebar/TeacherSidebar, untuk konsistensi struktur di semua portal.
function SidebarContent({ logoEmblem, logoFullWhite, filteredGroups, openGroups, toggleGroup, isActive, hasPendingBiodata, onLinkClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/10">
        {logoFullWhite ? (
          <div className="flex flex-col gap-1.5">
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Portal Siswa</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Image src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
            <div>
              <p className="font-heading font-bold text-white text-sm">Al Munawwir</p>
              <p className="text-white/50 text-xs">Portal Siswa</p>
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
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/30 hover:text-white/60 uppercase transition-colors">
                  <span>{group.label}</span>
                  <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const active = isActive(item.href, item.exact);
                    const showBadge = item.badgeKey === "pendingBiodata" && hasPendingBiodata;
                    const badgeCount = item.badge ?? 0;
                    return (
                      <Link key={item.href} href={item.href} onClick={onLinkClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                        <item.icon size={17} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Pengajuan menunggu persetujuan" />}
                        {badgeCount > 0 && (
                          <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 ${active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"}`}>
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
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

interface StudentSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  hasPendingBiodata?: boolean;
  isKelasAdmin?: boolean;
  overdueBooks?: number;
}

export default function StudentSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, hasPendingBiodata = false, isKelasAdmin = false, overdueBooks = 0 }: StudentSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const menuGroups: MenuGroup[] = [
    {
      label: null,
      items: [{ href: "/dashboard/student", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Akademik",
      items: [
        { href: "/dashboard/student/rapor", label: "Rapor Nilai", icon: Printer },
        { href: "/dashboard/student/materials", label: "Materi & Tugas", icon: BookOpen },
        { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion },
        { href: "/dashboard/student/pkl", label: "PKL Saya", icon: Briefcase },
        ...(isKelasAdmin ? [{ href: "/dashboard/student/absensi-kelas", label: "Absensi Kelas", icon: CheckSquare }] : []),
      ],
    },
    {
      label: "Kedisiplinan",
      items: [
        { href: "/dashboard/student/poin-saya", label: "Poin Saya", icon: ShieldAlert },
        { href: "/dashboard/student/tata-tertib", label: "Tata Tertib Peserta Didik", icon: BookOpenCheck },
      ],
    },
    {
      label: "Perpustakaan",
      items: [
        { href: "/dashboard/student/buku-saya", label: "Buku Saya", icon: BookOpen, badge: overdueBooks },
        { href: "/dashboard/student/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy },
      ],
    },
    {
      label: "Akun Saya",
      items: [
        { href: "/dashboard/student/biodata", label: "Biodata Saya", icon: IdCard, badgeKey: "pendingBiodata" },
        { href: "/dashboard/student/profile", label: "Profil Saya", icon: UserCircle },
      ],
    },
  ].map(g => ({ ...g, items: g.items.filter(item => "href" in item) })) as MenuGroup[];

  const visibleGroups = menuGroups.filter(g => g.items.length > 0);
  const ALL_HREFS = visibleGroups.flatMap(g => g.items.map(i => i.href));

  // PERBAIKAN 2026-08-10 (konsistensi dgn perbaikan sidebar admin/guru) — cegah 2 menu ke-highlight
  // bersamaan kalau suatu saat ada href yg jadi prefix href lain. Hanya href PALING SPESIFIK
  // (terpanjang) yg match dianggap aktif.
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

  // Setiap awal login/muat halaman SEMUA grup tertutup kecuali grup halaman aktif — sengaja tidak
  // ada restore dari localStorage (keputusan eksplisit user, sama seperti sidebar Admin/TAS/Guru).
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

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-primary-900 h-screen sticky top-0 shrink-0 overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent
          logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
          filteredGroups={visibleGroups} openGroups={openGroups} toggleGroup={toggleGroup}
          isActive={isActive} hasPendingBiodata={hasPendingBiodata} onLinkClick={() => setOpen(false)}
        />
      </aside>
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" unoptimized />
          ) : (
            <>
              <Image src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
              <span className="font-heading font-bold text-white text-sm">Portal Siswa</span>
            </>
          )}
        </div>
        <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white"><Menu size={22} /></button>
      </div>
      {open && (
        <div className="lg:hidden print:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-56 bg-primary-900 h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.10] pointer-events-none"
              style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat" }}
            />
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={20} /></button>
            <SidebarContent
              logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
              filteredGroups={visibleGroups} openGroups={openGroups} toggleGroup={toggleGroup}
              isActive={isActive} hasPendingBiodata={hasPendingBiodata} onLinkClick={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
