"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, School, UserCog, Briefcase,
  BookOpen, Globe, LogOut, Menu, X, Calendar, Bell, BarChart2, GraduationCap,
  UserCircle, ClipboardList, Repeat, Mail, Archive, BookMarked, ShieldCheck, Award, Building2, ListChecks, Boxes,
  UserCheck, HeartPulse, Flag, Library, Network, BadgeCheck, NotebookPen, FileQuestion, ArrowLeft, Trophy,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import NotificationBell from "@/components/shared/NotificationBell";

// Beberapa menu di sini sebenarnya fitur KHUSUS jabatan tertentu (UKS, Ekstrakurikuler,
// Perpustakaan, Jaringan Sekolah, Kedisiplinan Guru) — bukan tugas umum TAS. Dulu SEMUA staf TAS
// (termasuk yang jabatannya cuma "Kebersihan"/"Security" dsb) melihat & bisa membuka SEMUA menu
// ini, karena role TAS memang didesain auto-lolos setiap guard jabatan (lihat kedisiplinan-guard.ts
// dkk). Sekarang menu-menu itu cuma tampil kalau staf tsb BENAR punya jabatan terkait — guard di
// sisi API juga sudah dibenahi jadi tidak lagi auto-lolos begitu saja.
//
// Sidebar ini juga dipakai guru (role TEACHER) yang MERANGKAP jabatan "Tenaga Administrasi
// Sekolah"/"Kepala Tenaga Administrasi Sekolah" (lihat tas-access-guard.ts) — mereka BUKAN staf
// TAS penuh (tetap punya jadwal mengajar sendiri di portal guru), jadi item generik yang dulu
// `show: () => true` (Pendaftaran, Siswa, Kelas, dst — tugas kantor TAS umum, bukan spesifik TU)
// disyaratkan `full` (isFullTas) supaya guru-TU cuma melihat grup "Tata Usaha" + item jabatan yang
// benar dia pegang, bukan seluruh menu admin.
const menuGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Akademik",
    items: [
      { href: "/dashboard/admin/admissions", label: "Pendaftaran Siswa", icon: ClipboardList, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/students", label: "Siswa", icon: Users, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/teachers", label: "Guru & Pegawai", icon: UserCog, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/jabatan", label: "Jabatan", icon: Award, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/program-kerja", label: "Program Kerja", icon: ListChecks, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kedisiplinan-guru", label: "Kedisiplinan Guru", icon: BadgeCheck,
        show: (j: string[]) => j.includes("Wakil Kepala Bidang Penjamin Mutu") || j.includes("Wakil Kepala Kurikulum") || j.includes("Guru Piket") },
      { href: "/dashboard/admin/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/kinerja-saya", label: "Kinerja Saya", icon: Award, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/inventaris", label: "Inventaris Barang", icon: Boxes, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/uks", label: "UKS", icon: HeartPulse, show: (j: string[]) => j.includes("Kepala UKS") },
      { href: "/dashboard/admin/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag,
        show: (j: string[]) => j.includes("Koordinator Ekstrakurikuler") || j.some(n => n.startsWith("Pembina ")) },
      { href: "/dashboard/admin/perpustakaan", label: "Perpustakaan", icon: Library,
        show: (j: string[]) => j.includes("Koordinator Perpustakaan") || j.includes("Tim Perpustakaan") },
      { href: "/dashboard/admin/jaringan", label: "Jaringan Sekolah", icon: Network, show: (j: string[]) => j.includes("Pengelola Jaringan Sekolah") },
      { href: "/dashboard/admin/classes", label: "Kelas", icon: School, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/rpp", label: "Bank RPP", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/announcements", label: "Pengumuman", icon: Bell, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Tata Usaha",
    items: [
      { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/buku-induk/guru",  label: "Buku Induk Guru",  icon: UserCog, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/buku-mutasi",       label: "Buku Mutasi",      icon: Repeat, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/persuratan",        label: "Persuratan",       icon: Mail, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/arsip",             label: "Pengarsipan",      icon: Archive, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/notulen-rapat",     label: "Notulen Rapat",    icon: NotebookPen, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/verifikasi-data",   label: "Verifikasi Perubahan Data", icon: ShieldCheck, badgeKey: "pendingProfileEdits" as const, show: (_j: string[], _full: boolean) => true },
    ],
  },
  {
    label: "Lainnya",
    items: [
      { href: "/dashboard/admin/cek-kelulusan", label: "Cek Kelulusan", icon: GraduationCap, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/profile", label: "Profil Saya", icon: UserCircle, show: (_j: string[], _full: boolean) => true },
    ],
  },
];

interface TasSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  pendingProfileEdits?: number;
  jabatanNames?: string[];
  isFullTas?: boolean;
}

export default function TasSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, pendingProfileEdits = 0, jabatanNames = [], isFullTas = true }: TasSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const notifications = [
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
        {logoFullWhite ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Tata Usaha</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <NextImage src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
            <div>
              <p className="font-heading font-bold text-white text-sm leading-tight">Al Munawwir</p>
              <p className="text-white/50 text-xs">Tenaga Administrasi</p>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-4">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(item => item.show(jabatanNames, isFullTas));
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label ?? "__root__"}>
            {group.label && (
              <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-white/30 uppercase">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                // Guru-TU (bukan TAS penuh) pakai profil guru asli (akun & password sama, halaman
                // /dashboard/admin/profile khusus role ADMIN/TAS) supaya link tidak 500/redirect.
                const href = item.href === "/dashboard/admin/profile" && !isFullTas ? "/dashboard/teacher/profile" : item.href;
                const active = isActive(href, "exact" in item ? item.exact : false);
                const badgeCount = "badgeKey" in item && item.badgeKey === "pendingProfileEdits" ? pendingProfileEdits : 0;
                return (
                  <Link
                    key={item.href}
                    href={href}
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
                      <span className="text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {!isFullTas && (
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <ArrowLeft size={18} />
            Portal Guru
          </Link>
        )}
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
      <aside className="hidden lg:flex flex-col w-60 bg-primary-900 h-screen sticky top-0 shrink-0 relative overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent />
      </aside>

      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" unoptimized />
          ) : (
            <>
              <NextImage src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
              <span className="font-heading font-bold text-white text-sm">TAS Panel</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell items={notifications} variant="dark" />
          <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white p-2">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden print:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-primary-900 h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.10] pointer-events-none"
              style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat" }}
            />
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
