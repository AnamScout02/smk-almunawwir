"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, School, UserCog, Briefcase,
  BookOpen, Globe, LogOut, Menu, X, Calendar, Bell, BarChart2, GraduationCap,
  UserCircle, ClipboardList, Repeat, Mail, Archive, BookMarked, ShieldCheck, Award, Building2, ListChecks, Boxes,
  UserCheck, HeartPulse, Flag, Library, Network, BadgeCheck, NotebookPen, FileQuestion, ArrowLeft, Trophy, IdCard,
  ChevronDown, Search, CheckSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
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
      { href: "/dashboard/admin/classes", label: "Kelas", icon: School, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/teachers", label: "Guru & Pegawai", icon: UserCog, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/jabatan", label: "Jabatan", icon: Award, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/program-kerja", label: "Program Kerja", icon: ListChecks, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/announcements", label: "Pengumuman", icon: Bell, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Jadwal & Pengajaran",
    items: [
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/rpp", label: "Bank RPP", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Kedisiplinan & Kinerja",
    items: [
      { href: "/dashboard/admin/kedisiplinan-guru", label: "Kedisiplinan Guru", icon: BadgeCheck,
        show: (j: string[]) => j.includes("Wakil Kepala Bidang Penjamin Mutu") || j.includes("Wakil Kepala Kurikulum") || j.includes("Guru Piket") },
      { href: "/dashboard/admin/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/kinerja-saya", label: "Kinerja Saya", icon: Award, show: (_j: string[], _full: boolean) => true },
    ],
  },
  {
    label: "PKL & Karir",
    items: [
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Sarana & Layanan Siswa",
    items: [
      { href: "/dashboard/admin/inventaris", label: "Inventaris Barang", icon: Boxes, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/uks", label: "UKS", icon: HeartPulse, show: (j: string[]) => j.includes("Kepala UKS") },
      { href: "/dashboard/admin/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag,
        show: (j: string[]) => j.includes("Koordinator Ekstrakurikuler") || j.some(n => n.startsWith("Pembina ")) },
      { href: "/dashboard/admin/absen-ekstra", label: "Absen Ekstra", icon: CheckSquare,
        show: (j: string[]) => j.includes("Koordinator Ekstrakurikuler") || j.some(n => n.startsWith("Pembina ")) },
      { href: "/dashboard/admin/perpustakaan", label: "Perpustakaan", icon: Library,
        show: (j: string[]) => j.includes("Koordinator Perpustakaan") || j.includes("Tim Perpustakaan") },
      { href: "/dashboard/admin/buku-saya", label: "Buku Saya", icon: BookOpen, badgeKey: "overdueBooks" as const, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/jaringan", label: "Jaringan Sekolah", icon: Network, show: (j: string[]) => j.includes("Pengelola Jaringan Sekolah") },
    ],
  },
  {
    label: "Tata Usaha",
    // PERBAIKAN KRITIS 2026-08-10 (temuan user): dulu SEMUA item di sini `show: () => true` —
    // literally mengabaikan parameter `full` walau komentar di atas bilang seharusnya disyaratkan.
    // Akibatnya staf TAS non-TU (Security/Kebersihan/dll) TETAP LIHAT menu Buku Induk/Persuratan/
    // Pengarsipan dkk di sidebar (walau API-nya sendiri sudah benar ditolak lewat verifyTasAccess,
    // lihat tas-access-guard.ts) — membingungkan & tetap celah kalau ada halaman TU yg lupa proteksi
    // sendiri. Sekarang benar-benar disyaratkan `full` (isFullTasJabatan).
    items: [
      { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/buku-induk/guru",  label: "Buku Induk Guru",  icon: UserCog, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/buku-mutasi",       label: "Buku Mutasi",      icon: Repeat, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/persuratan",        label: "Persuratan",       icon: Mail, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/arsip",             label: "Pengarsipan",      icon: Archive, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/notulen-rapat",     label: "Notulen Rapat",    icon: NotebookPen, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kartu-tanda",       label: "Kartu Tanda",      icon: IdCard, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/verifikasi-data",   label: "Verifikasi Perubahan Data", icon: ShieldCheck, badgeKey: "pendingProfileEdits" as const, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/bel-sekolah",       label: "Bel Sekolah Otomatis", icon: Bell, show: (_j: string[], full: boolean) => full },
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

interface RenderItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badgeKey?: "pendingProfileEdits" | "overdueBooks" }
interface RenderGroup { label: string | null; items: RenderItem[] }

const ALL_HREFS = menuGroups.flatMap(g => g.items.map(i => i.href));

interface SidebarContentProps {
  logoEmblem: string;
  logoFullWhite?: string;
  isFullTas: boolean;
  search: string;
  setSearch: (v: string) => void;
  filteredGroups: RenderGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
  pendingProfileEdits: number;
  overdueBooks: number;
  onLinkClick: () => void;
}

// Komponen TERPISAH di luar TasSidebar (bukan didefinisikan ulang di dalam body tiap render) —
// lihat komentar lengkap di AdminSidebar.tsx: kalau didefinisikan di dalam, React membongkar-pasang
// ulang seluruh sidebar tiap ketikan di kotak pencarian, bikin input kehilangan fokus tiap huruf.
function SidebarContent({
  logoEmblem, logoFullWhite, isFullTas, search, setSearch, filteredGroups, openGroups, toggleGroup, isActive, pendingProfileEdits, overdueBooks, onLinkClick,
}: SidebarContentProps) {
  return (
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

      {/* Cari menu — filter cepat lintas grup */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:bg-white/10 transition-colors"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scroll space-y-1">
        {filteredGroups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-white/30">Tidak ada menu yang cocok.</p>
        )}
        {filteredGroups.map((group) => {
          const isRoot = group.label === null;
          const isOpen = isRoot || !!search.trim() || openGroups.has(group.label!);
          return (
          <div key={group.label ?? "__root__"} className={isRoot ? "" : "pt-2"}>
            {group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/30 hover:text-white/60 uppercase transition-colors"
              >
                <span>{group.label}</span>
                <ChevronDown size={12} className={`shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
              </button>
            )}
            {isOpen && (
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Guru-TU (bukan TAS penuh) pakai profil guru asli (akun & password sama, halaman
                // /dashboard/admin/profile khusus role ADMIN/TAS) supaya link tidak 500/redirect.
                const href = item.href === "/dashboard/admin/profile" && !isFullTas ? "/dashboard/teacher/profile" : item.href;
                const active = isActive(href, item.exact);
                const badgeCount = item.badgeKey === "pendingProfileEdits" ? pendingProfileEdits : item.badgeKey === "overdueBooks" ? overdueBooks : 0;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={onLinkClick}
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
            )}
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
}

interface TasSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  pendingProfileEdits?: number;
  overdueBooks?: number;
  jabatanNames?: string[];
  isFullTas?: boolean;
}

const OPEN_GROUPS_KEY = "tas-sidebar-open-groups";

export default function TasSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, pendingProfileEdits = 0, overdueBooks = 0, jabatanNames = [], isFullTas = true }: TasSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // PERBAIKAN 2026-08-10 (temuan user, screenshot: 2 menu ke-highlight bersamaan) — kalau href
  // menu A jadi prefix dari href menu B, dulu KEDUANYA dianggap aktif. Sekarang hanya href PALING
  // SPESIFIK (terpanjang) yg match dianggap aktif.
  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    if (pathname !== href && !pathname.startsWith(href + "/")) return false;
    const moreSpecific = ALL_HREFS.some(h => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + "/")));
    return !moreSpecific;
  }

  // Grup yang benar2 punya item terlihat (sesuai jabatan) DAN cocok dengan pencarian.
  const visibleGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(item => item.show(jabatanNames, isFullTas)) }))
    .filter(g => g.items.length > 0) as RenderGroup[];

  function activeGroupLabel(): string | null {
    for (const g of visibleGroups) {
      if (!g.label) continue;
      if (g.items.some(item => isActive(item.href, !!item.exact))) return g.label;
    }
    return null;
  }

  // Accordion satu-per-satu (lihat komentar lengkap di AdminSidebar.tsx) — buka grup lain otomatis
  // menutup yang sedang terbuka.
  useEffect(() => {
    const active = activeGroupLabel();
    if (active) { setOpenGroups(new Set([active])); return; }
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "[]"); } catch {}
    setOpenGroups(new Set(saved.slice(0, 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const active = activeGroupLabel();
    if (!active) return;
    setOpenGroups(new Set([active]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = prev.has(label) ? new Set<string>() : new Set([label]);
      localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const q = search.trim().toLowerCase();
  const filteredGroups = visibleGroups
    .map(g => ({ ...g, items: q ? g.items.filter(i => i.label.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length > 0);

  const notifications = [
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
  ];

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 bg-primary-900 h-screen sticky top-0 shrink-0 relative overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent
          logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} isFullTas={isFullTas}
          search={search} setSearch={setSearch}
          filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
          isActive={isActive} pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} onLinkClick={() => setOpen(false)}
        />
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
            <SidebarContent
              logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} isFullTas={isFullTas}
              search={search} setSearch={setSearch}
              filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
              isActive={isActive} pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} onLinkClick={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
