"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, Users, LogOut, Menu, X, Globe, UserCircle } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions/auth";

const menu = [
  { href: "/dashboard/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/teacher/students", label: "Daftar Siswa", icon: Users },
  { href: "/dashboard/teacher/grades", label: "Input Nilai", icon: ClipboardList },
  { href: "/dashboard/teacher/attendance", label: "Absensi", icon: CheckSquare },
  { href: "/dashboard/teacher/profile", label: "Profil Saya", icon: UserCircle },
];

export default function TeacherSidebar({ logoEmblem = "/images/logo-emblem.png" }: { logoEmblem?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
          <div>
            <p className="font-heading font-bold text-white text-sm">Al-Munawwir</p>
            <p className="text-white/50 text-xs">Portal Guru</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menu.map(item => {
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <item.icon size={17} />
              {item.label}
            </Link>
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

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-primary-900 min-h-screen shrink-0 fixed top-0 left-0 bottom-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent />
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Image src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
          <span className="font-heading font-bold text-white text-sm">Portal Guru</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white"><Menu size={22} /></button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-56 bg-primary-900 h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.10] pointer-events-none"
              style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat" }}
            />
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={20} /></button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
