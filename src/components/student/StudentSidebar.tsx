"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BookOpenText, LayoutDashboard, Printer, IdCard, UserCircle, LogOut, Globe, Briefcase, BookOpen, CheckSquare, FileQuestion, Trophy, ShieldAlert, BookOpenCheck, ChevronDown, Library, FileText, Vote } from "lucide-react";
import { QrCode, MessagesSquare, MessageSquareHeart, Megaphone, ClipboardPen, BriefcaseBusiness, CircleHelp, DoorOpen } from "lucide-react";
import { CalendarX2, Flag, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

interface MenuItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number; badgeKey?: "pendingBiodata" | "buktiIzinKeluar" }
interface MenuGroup { label: string | null; items: MenuItem[] }

interface SidebarContentProps {
  logoEmblem: string;
  logoFullWhite?: string;
  filteredGroups: MenuGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
  hasPendingBiodata: boolean;
  buktiIzinKeluar: number;
  onLinkClick: () => void;
}

// Komponen TERPISAH di luar StudentSidebar — lihat komentar lengkap di AdminSidebar.tsx (kalau
// didefinisikan di dalam body, React membongkar-pasang ulang seluruh sidebar tiap render parent).
// PERBAIKAN 2026-08-11 (keputusan eksplisit user) — dikelompokkan + accordion, sama seperti
// AdminSidebar/TasSidebar/TeacherSidebar, untuk konsistensi struktur di semua portal.
function SidebarContent({ logoEmblem, logoFullWhite, filteredGroups, openGroups, toggleGroup, isActive, hasPendingBiodata, buktiIzinKeluar, onLinkClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/10">
        {logoFullWhite ? (
          <div className="flex flex-col gap-1.5">
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Portal Siswa</p>
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
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-bold tracking-wider text-white/30 hover:text-white/60 uppercase transition-colors text-left">
                  <span>{group.label}</span>
                  <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const active = isActive(item.href, item.exact);
                    const showBadge = (item.badgeKey === "pendingBiodata" && hasPendingBiodata)
                      || (item.badgeKey === "buktiIzinKeluar" && buktiIzinKeluar > 0);
                    const badgeCount = item.badge ?? 0;
                    return (
                      <Link key={item.href} href={item.href} onClick={onLinkClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                        <item.icon size={17} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Pengajuan menunggu persetujuan" />}
                        {badgeCount > 0 && (
                          <span className={`text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 ${active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"}`}>
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
  /** Jumlah izin keluar yang bukti fotonya belum diunggah siswa (30 Sep 2026). */
  buktiIzinKeluar?: number;
  isKelasAdmin?: boolean;
  overdueBooks?: number;
  /** Admin sedang "Masuk Sebagai" akun ini — topbar mobile digeser turun supaya tidak ketutup
   * pita ImpersonationBanner. Lihat catatan sama di TeacherSidebar.tsx. */
  impersonating?: boolean;
  tindakan?: { label: string; count: number; href: string }[];
  kelasXII?: boolean;
}

/** SATU SUMBER menu Portal Siswa — dipakai sidebar desktop, bottom nav HP, DAN kisi "Semua Menu"
 * di dashboard (MenuLengkap). Jangan mendaftar ulang menu di tempat lain. */
export function grupMenuSiswa({ hasPendingBiodata = false, isKelasAdmin = false, overdueBooks = 0, kelasXII = false }: StudentSidebarProps = {}): MenuGroup[] {
  void hasPendingBiodata;
  return [
    {
      label: null,
      items: [{ href: "/dashboard/student", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Akademik",
      items: [
        { href: "/dashboard/student/materials", label: "Materi & Tugas", icon: BookOpen },
        { href: "/ujian-online", label: "Ujian Online (CBT)", icon: FileQuestion },
        { href: "/dashboard/student/rapor", label: "Rapor Nilai", icon: Printer },
        { href: "/dashboard/student/portofolio", label: "Portofolio Saya", icon: Trophy },
        { href: "/dashboard/student/lomba", label: "Lomba & Event", icon: Medal },
        { href: "/dashboard/student/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag },
        { href: "/dashboard/student/pkl", label: "PKL Saya", icon: Briefcase },
        ...(kelasXII ? [{ href: "/dashboard/student/lowongan", label: "Lowongan Kerja", icon: BriefcaseBusiness }] : []),
      ],
    },
    {
      // Kehadiran & kedisiplinan satu grup — alur harian siswa: absen, lalu poin/tata tertib (keputusan user 15 Sep 2026).
      label: "Kehadiran & Kedisiplinan",
      items: [
        { href: "/dashboard/student/absen-mandiri", label: "Absen Mandiri (QR)", icon: QrCode },
        ...(isKelasAdmin ? [{ href: "/dashboard/student/absensi-kelas", label: "Absensi Kelas", icon: CheckSquare }] : []),
        { href: "/dashboard/student/izin-keluar", label: "Izin Keluar", icon: DoorOpen, badgeKey: "buktiIzinKeluar" },
        { href: "/dashboard/student/kegiatan-tidak-ikut", label: "Tidak Ikut Kegiatan", icon: CalendarX2 },
        { href: "/dashboard/student/poin-saya", label: "Poin Saya", icon: ShieldAlert },
        { href: "/dashboard/student/konseling", label: "Konseling BK", icon: MessagesSquare },
        { href: "/dashboard/student/aspirasi", label: "Kotak Aspirasi", icon: MessageSquareHeart },
        { href: "/dashboard/student/pemilihan", label: "Pemilihan OSIS", icon: Vote },
        { href: "/dashboard/student/tata-tertib", label: "Tata Tertib Peserta Didik", icon: BookOpenCheck },
      ],
    },
    {
      label: "Perpustakaan",
      items: [
        { href: "/perpustakaan", label: "Perpustakaan Digital", icon: Library },
        { href: "/dashboard/student/buku-saya", label: "Buku Saya", icon: BookOpen, badge: overdueBooks },
        { href: "/dashboard/student/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy },
      ],
    },
    {
      label: "Akun Saya",
      items: [
        { href: "/dashboard/student/pengumuman", label: "Pengumuman", icon: Megaphone },
        { href: "/dashboard/student/survei", label: "Survei & Angket", icon: ClipboardPen },
        { href: "/dashboard/student/biodata", label: "Biodata Saya", icon: IdCard, badgeKey: "pendingBiodata" },
        { href: "/dashboard/student/permintaan-surat", label: "Permintaan Surat", icon: FileText },
        { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
        { href: "/dashboard/student/profile", label: "Profil Saya", icon: UserCircle },
        { href: "/bantuan", label: "Pusat Bantuan", icon: CircleHelp },
        { href: "/dashboard/student/panduan", label: "Panduan", icon: BookOpenText },
      ],
    },
  ].map(g => ({ ...g, items: g.items.filter(item => "href" in item) })) as MenuGroup[];
}

export default function StudentSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, hasPendingBiodata = false, buktiIzinKeluar = 0, isKelasAdmin = false, overdueBooks = 0, impersonating = false, tindakan = [], kelasXII = false }: StudentSidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const menuGroups = grupMenuSiswa({ hasPendingBiodata, isKelasAdmin, overdueBooks, kelasXII });
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

  // Bottom nav HP (18 Sep 2026): 4 tautan harian + tombol tengah Dashboard, TANPA sheet.
  // Menu selengkapnya ada di kisi "Semua Menu" pada dashboard (MenuLengkap) & /dashboard/student/menu.
  const navBawah: ItemNavBawah[] = [
    { href: "/dashboard/student/materials", label: "Tugas", icon: BookOpen, simbol: "menu_book" },
    { href: "/dashboard/student/absen-mandiri", label: "Absen", icon: QrCode, simbol: "qr_code_scanner" },
    { href: "/dashboard/student/rapor", label: "Rapor", icon: Printer, simbol: "description" },
    { href: "/dashboard/student/buku-saya", label: "Buku", icon: Library, simbol: "local_library", badge: overdueBooks },
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
          isActive={isActive} hasPendingBiodata={hasPendingBiodata} buktiIzinKeluar={buktiIzinKeluar} onLinkClick={() => {}}
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
              <span className="font-heading font-bold text-white text-sm">Portal Siswa</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <KotakNotifikasiTombol variant="topbar" tindakan={tindakan} />
          <MenuAkunMobile profilHref="/dashboard/student/profile" />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/student", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
