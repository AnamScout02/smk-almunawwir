"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Image, Newspaper, GalleryHorizontal,
  ClipboardList, Users, MessageSquare, LogOut, Menu, X,
  Settings, FileText, School, UserCog, BookOpen, Globe, Briefcase, UserCircle, BarChart2, Bell, Calendar, Database, CalendarDays,
  Archive, Repeat, Mail, BookMarked, Clock, Users2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";

const COLLAPSE_KEY = "admin-sidebar-collapsed";

const menuGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, badge: 0 },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/dashboard/admin/banners", label: "Banner / Hero", icon: Image, badge: 0 },
      { href: "/dashboard/admin/news", label: "Berita", icon: Newspaper, badge: 0 },
      { href: "/dashboard/admin/gallery", label: "Galeri Foto", icon: GalleryHorizontal, badge: 0 },
      { href: "/dashboard/admin/content", label: "Konten Halaman", icon: FileText, badge: 0 },
      { href: "/dashboard/admin/admissions", label: "Pendaftaran", icon: ClipboardList, badgeKey: "pendingAdmissions" as const },
      { href: "/dashboard/admin/messages", label: "Pesan Masuk", icon: MessageSquare, badgeKey: "unreadMessages" as const },
      { href: "/dashboard/admin/announcements", label: "Pengumuman", icon: Bell, badge: 0 },
    ],
  },
  {
    label: "Akademik",
    items: [
      { href: "/dashboard/admin/majors", label: "Jurusan", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/classes", label: "Kelas", icon: School, badge: 0 },
      { href: "/dashboard/admin/students", label: "Siswa", icon: Users, badge: 0 },
      { href: "/dashboard/admin/teachers", label: "Guru", icon: UserCog, badge: 0 },
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, badge: 0 },
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, badge: 0 },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, badge: 0 },
      { href: "/dashboard/admin/teaching-assignments", label: "Penugasan Mengajar", icon: Users2, badge: 0 },
      { href: "/dashboard/admin/school-periods", label: "Kerangka Jam Pelajaran", icon: Clock, badge: 0 },
    ],
  },
  {
    label: "Tata Usaha",
    items: [
      { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog, badge: 0 },
      { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat, badge: 0 },
      { href: "/dashboard/admin/persuratan", label: "Persuratan", icon: Mail, badge: 0 },
      { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive, badge: 0 },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/dashboard/admin/users", label: "Akun Pengguna", icon: Settings, badge: 0 },
      { href: "/dashboard/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarDays, badge: 0 },
      { href: "/dashboard/admin/master-data", label: "Master Data", icon: Database, badge: 0 },
      { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, badge: 0 },
      { href: "/dashboard/admin/profile", label: "Profil Admin", icon: UserCircle, badge: 0 },
    ],
  },
];

type BadgeKey = "pendingAdmissions" | "unreadMessages";

interface AdminSidebarProps {
  unreadMessages?: number;
  pendingAdmissions?: number;
  logoEmblem?: string;
  logoFullWhite?: string;
}

export default function AdminSidebar({ unreadMessages = 0, pendingAdmissions = 0, logoEmblem = "/images/logo-emblem.png", logoFullWhite }: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const badges: Record<BadgeKey, number> = { unreadMessages, pendingAdmissions };

  function getBadge(item: { badge?: number; badgeKey?: BadgeKey }): number {
    if ("badgeKey" in item && item.badgeKey) return badges[item.badgeKey] ?? 0;
    return 0;
  }

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const SidebarContent = ({ collapsed: c = false, onToggle }: { collapsed?: boolean; onToggle?: () => void } = {}) => (
    <div className="flex flex-col h-full">
      {/* Logo — klik untuk buka/tutup sidebar (desktop) */}
      <button
        type="button"
        onClick={onToggle}
        title={onToggle ? (c ? "Buka sidebar" : "Tutup sidebar") : undefined}
        className={`px-5 py-4 border-b border-white/10 text-left w-full ${onToggle ? "hover:bg-white/5 cursor-pointer" : "cursor-default"} transition-colors`}
      >
        {c ? (
          <div className="flex justify-center">
            <NextImage src={logoEmblem} alt="Logo" width={32} height={32} className="rounded-full object-contain shrink-0" unoptimized />
          </div>
        ) : logoFullWhite ? (
          <div className="flex flex-col gap-1.5">
            <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Panel Admin</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <NextImage src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
            <div>
              <p className="font-heading font-bold text-white text-sm leading-tight">Al Munawwir</p>
              <p className="text-white/50 text-xs">Panel Admin</p>
            </div>
          </div>
        )}
      </button>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden space-y-4" style={{ scrollbarWidth: "none" }}>
        {menuGroups.map((group) => (
          <div key={group.label ?? "__root__"}>
            {group.label && !c && (
              <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-white/30 uppercase">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, "exact" in item ? (item as { exact?: boolean }).exact ?? false : false);
                const badgeCount = getBadge(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    title={c ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${c ? "justify-center" : ""} ${
                      active
                        ? "bg-gold text-primary-900 shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!c && <span className="flex-1">{item.label}</span>}
                    {badgeCount > 0 && !c && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                        active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"
                      }`}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                    {badgeCount > 0 && c && (
                      <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/"
          title={c ? "Lihat Website" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all ${c ? "justify-center" : ""}`}
        >
          <Globe size={18} />
          {!c && "Lihat Website"}
        </Link>
        <form action={logout}>
          <button
            type="submit"
            title={c ? "Keluar" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all ${c ? "justify-center" : ""}`}
          >
            <LogOut size={18} />
            {!c && "Keluar"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col ${collapsed ? "w-[76px]" : "w-60"} bg-primary-900 h-screen sticky top-0 shrink-0 relative overflow-hidden print:hidden transition-[width] duration-200`}>
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" unoptimized />
          ) : (
            <>
              <NextImage src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
              <span className="font-heading font-bold text-white text-sm">Admin Panel</span>
            </>
          )}
        </div>
        <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white">
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden print:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-primary-900 h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.10] pointer-events-none"
              style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat" }}
            />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
