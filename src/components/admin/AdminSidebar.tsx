"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Image, Newspaper, GalleryHorizontal,
  ClipboardList, Users, MessageSquare, LogOut, Menu, X,
  Settings, FileText, School, UserCog, BookOpen, Globe, Briefcase, UserCircle, BarChart2, Bell, Calendar,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions/auth";

const menuItems = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, badge: 0 },
  { href: "/dashboard/admin/banners", label: "Banner / Hero", icon: Image, badge: 0 },
  { href: "/dashboard/admin/news", label: "Berita", icon: Newspaper, badge: 0 },
  { href: "/dashboard/admin/gallery", label: "Galeri Foto", icon: GalleryHorizontal, badge: 0 },
  { href: "/dashboard/admin/admissions", label: "Pendaftaran", icon: ClipboardList, badgeKey: "pendingAdmissions" },
  { href: "/dashboard/admin/majors", label: "Jurusan", icon: BookOpen, badge: 0 },
  { href: "/dashboard/admin/classes", label: "Kelas", icon: School, badge: 0 },
  { href: "/dashboard/admin/students", label: "Siswa", icon: Users, badge: 0 },
  { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, badge: 0 },
  { href: "/dashboard/admin/teachers", label: "Guru", icon: UserCog, badge: 0 },
  { href: "/dashboard/admin/users", label: "Akun Pengguna", icon: Settings, badge: 0 },
  { href: "/dashboard/admin/messages", label: "Pesan Masuk", icon: MessageSquare, badgeKey: "unreadMessages" },
  { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, badge: 0 },
  { href: "/dashboard/admin/announcements", label: "Pengumuman", icon: Bell, badge: 0 },
  { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, badge: 0 },
  { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog, badge: 0 },
  { href: "/dashboard/admin/content", label: "Konten Halaman", icon: FileText, badge: 0 },
  { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, badge: 0 },
  { href: "/dashboard/admin/profile", label: "Profil Admin", icon: UserCircle, badge: 0 },
] as const;

type BadgeKey = "pendingAdmissions" | "unreadMessages";

interface AdminSidebarProps {
  unreadMessages?: number;
  pendingAdmissions?: number;
  logoEmblem?: string;
}

export default function AdminSidebar({ unreadMessages = 0, pendingAdmissions = 0, logoEmblem = "/images/logo-emblem.png" }: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const badges: Record<BadgeKey, number> = { unreadMessages, pendingAdmissions };

  function getBadge(item: typeof menuItems[number]): number {
    if ("badgeKey" in item) return badges[item.badgeKey as BadgeKey] ?? 0;
    return 0;
  }

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <NextImage src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
          <div>
            <p className="font-heading font-bold text-white text-sm leading-tight">Al-Munawwir</p>
            <p className="text-white/50 text-xs">Panel Admin</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.href, "exact" in item ? item.exact : false);
          const badgeCount = getBadge(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-gold text-primary-900 shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"
                }`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <Globe size={18} />
          Lihat Website
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-primary-900 min-h-screen shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent />
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <NextImage src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
          <span className="font-heading font-bold text-white text-sm">Admin Panel</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white">
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
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
