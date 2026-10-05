"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, School, UserCog, Briefcase,
  BookOpen, Globe, LogOut, Calendar, CalendarCheck, Bell, BarChart2, GraduationCap,
  UserCircle, ClipboardList, Repeat, Mail, Archive, BookMarked, Award, Building2, ListChecks, Boxes,
  UserCheck, HeartPulse, Flag, Library, Network, BadgeCheck, NotebookPen, FileQuestion, ArrowLeft, Trophy, Medal, IdCard,
  ChevronDown, Search, CheckSquare, MoreHorizontal, Wallet, FileSpreadsheet,
  BookA, BookUser, Stamp, FileText, CalendarOff, HandCoins, ClipboardCheck, ScanSearch,
  Forward, Send, Inbox, ClipboardSignature, CalendarDays, DatabaseZap,
  Megaphone, Hammer, ClipboardPen, BriefcaseBusiness, UserPlus, CircleHelp, QrCode, LayoutGrid, 
} from "lucide-react";
import { FileUser } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import NotificationBell from "@/components/shared/NotificationBell";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

// Sinkron manual dgn BENDAHARA_JABATAN di src/lib/bendahara-guard.ts (server-only, tidak bisa
// diimpor ke komponen client ini) — pola sama seperti TAS_JABATAN yg juga di-hardcode ulang di
// sidebar client, bukan diimpor dari tas-access-guard.ts.
const BENDAHARA_JABATAN = ["Bendahara Sekolah", "Bendahara BOS", "Bendahara BPOPP"];

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
export const menuGroupsTas = [
  {
    label: null,
    items: [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Data Siswa & Guru",
    items: [
      { href: "/pusat-spmb", label: "Pusat SPMB", icon: ClipboardList, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/students", label: "Siswa", icon: Users, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/classes", label: "Kelas", icon: School, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/teachers", label: "Guru & Pegawai", icon: UserCog, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/jabatan", label: "Jabatan", icon: Award, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Kurikulum & Pembelajaran",
    items: [
      { href: "/dashboard/admin/kalender-pendidikan", label: "Kalender Pendidikan", icon: CalendarDays, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/pemeriksa-jadwal", label: "Pemeriksa Jadwal", icon: CalendarCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/rpp", label: "Bank RPP", icon: BookMarked, show: (_j: string[], full: boolean) => full },
      { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Kesiswaan & BK",
    items: [
      { href: "/dashboard/admin/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag,
        show: (j: string[]) => j.includes("Koordinator Ekstrakurikuler") || j.some(n => n.startsWith("Pembina ")) },
      { href: "/dashboard/admin/absen-ekstra", label: "Absen Ekstra", icon: CheckSquare,
        show: (j: string[]) => j.includes("Koordinator Ekstrakurikuler") || j.some(n => n.startsWith("Pembina ")) },
      { href: "/dashboard/admin/uks", label: "UKS", icon: HeartPulse, show: (j: string[]) => j.includes("Kepala UKS") },
      { href: "/dashboard/admin/bantuan-siswa", label: "Bantuan & Beasiswa", icon: HandCoins, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Kepegawaian & Kinerja",
    items: [
      { href: "/dashboard/admin/tugas", label: "Papan Tugas", icon: ClipboardList, show: (_j: string[], _f: boolean) => true },
      { href: "/dashboard/admin/pkb", label: "Portofolio PKB", icon: Award, show: (_j: string[], _f: boolean) => true },
      { href: "/dashboard/admin/presensi-pegawai", label: "Presensi Pegawai", icon: UserCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kegiatan", label: "Presensi Kegiatan (QR)", icon: CalendarCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/arsip-sk", label: "Arsip SK & Dokumen", icon: Archive, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/cuti", label: "Cuti Pegawai", icon: CalendarOff, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kedisiplinan-guru", label: "Kedisiplinan Guru", icon: BadgeCheck,
        show: (j: string[]) => j.includes("Wakil Kepala Bidang Penjamin Mutu") || j.includes("Wakil Kepala Kurikulum") || j.includes("Guru Piket") },
      { href: "/dashboard/admin/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/kinerja-saya", label: "Kinerja Saya", icon: Award, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/program-kerja", label: "Program Kerja", icon: ListChecks, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "PKL & Alumni",
    items: [
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/lowongan", label: "Lowongan Kerja BKK", icon: BriefcaseBusiness, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "TU — Buku Induk & Data",
    items: [
      { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, show: (j: string[], full: boolean) => full || j.includes("Operator Sekolah") },
      { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog, show: (j: string[], full: boolean) => full || j.includes("Operator Sekolah") },
      { href: "/dashboard/admin/buku-klapper", label: "Buku Klapper", icon: BookA, show: (j: string[], full: boolean) => full || j.includes("Operator Sekolah") },
      { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kenaikan-kelas", label: "Buku Kenaikan Kelas", icon: GraduationCap, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/pemeriksa-data", label: "Pemeriksa Data", icon: ScanSearch, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/dapodik", label: "Sinkron Dapodik", icon: DatabaseZap, show: (j: string[], full: boolean) => full || j.includes("Operator Sekolah") },
    ],
  },
  {
    label: "TU — Persuratan",
    items: [
      { href: "/dashboard/admin/persuratan", label: "Agenda Surat", icon: Mail, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/disposisi", label: "Disposisi Surat Masuk", icon: Forward, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/ekspedisi", label: "Buku Ekspedisi", icon: Send, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/permintaan-surat", label: "Permintaan Surat", icon: Inbox, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "TU — Layanan & Dokumen",
    items: [
      { href: "/dashboard/admin/rapor-siswa", label: "Penerimaan Rapor", icon: ClipboardCheck, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/cek-kelulusan", label: "Cek Kelulusan", icon: GraduationCap, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/ijazah-serah", label: "Penyerahan Ijazah", icon: GraduationCap, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/legalisir", label: "Legalisir Dokumen", icon: Stamp, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/kartu-tanda", label: "Kartu Tanda", icon: IdCard, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/buku-tamu", label: "Buku Tamu", icon: BookUser, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/nominatif", label: "Nominatif Kelas XII", icon: FileSpreadsheet, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/profil-sekolah", label: "Profil Sekolah", icon: Building2, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Sarana & Perpustakaan",
    items: [
      { href: "/dashboard/admin/inventaris", label: "Inventaris Barang", icon: Boxes, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/layanan-sarpras", label: "Layanan Sarpras", icon: Hammer, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/jaringan", label: "Jaringan & Layar", icon: Network, show: (j: string[], full: boolean) => full || j.includes("Pengelola Jaringan Sekolah") },
      { href: "/dashboard/admin/usulan-alat", label: "Usulan Alat & Bahan", icon: Boxes, show: (_j: string[], _full: boolean) => true },
      { href: "/pusat-perpustakaan", label: "Pusat Perpustakaan", icon: Library,
        show: (j: string[]) => j.includes("Koordinator Perpustakaan") || j.includes("Tim Perpustakaan") },
      { href: "/perpustakaan", label: "Perpustakaan Digital", icon: BookOpen, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/buku-saya", label: "Buku Saya", icon: BookOpen, badgeKey: "overdueBooks" as const, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/bel-sekolah", label: "Bel Sekolah Otomatis", icon: Bell, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { href: "/dashboard/bendahara", label: "Bendahara", icon: Wallet, show: (j: string[]) => j.some(n => BENDAHARA_JABATAN.includes(n)) },
    ],
  },
  {
    label: "Website & Informasi",
    items: [
      { href: "/dashboard/admin/announcements", label: "Kelola Pengumuman", icon: Bell, show: (_j: string[], full: boolean) => full },
      { href: "/dashboard/admin/event", label: "Lomba & Event", icon: Medal, show: (_j: string[], full: boolean) => full },
    ],
  },
  {
    label: "Akun Saya",
    items: [
      { href: "/dashboard/admin/pengumuman", label: "Pengumuman", icon: Megaphone, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/survei-saya", label: "Survei & Angket", icon: ClipboardPen, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/absen-mandiri", label: "Presensi Mandiri", icon: QrCode, show: (_j: string[], _full: boolean) => true },
      { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/biodata", label: "Biodata Saya", icon: FileUser, show: (_j: string[], _full: boolean) => true },
      { href: "/dashboard/admin/profile", label: "Profil Saya", icon: UserCircle, show: (_j: string[], _full: boolean) => true },
      { href: "/bantuan", label: "Pusat Bantuan", icon: CircleHelp, show: (_j: string[], _full: boolean) => true },
    ],
  },
];

interface RenderItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badgeKey?: "pendingProfileEdits" | "overdueBooks" }
interface RenderGroup { label: string | null; items: RenderItem[] }

const ALL_HREFS = menuGroupsTas.flatMap(g => g.items.map(i => i.href));

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
            <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Tata Usaha</p>
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
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
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
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-bold tracking-wider text-white/30 hover:text-white/60 uppercase transition-colors text-left"
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
                      <span className="text-[11px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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
  /** Admin sedang "Masuk Sebagai" akun ini — topbar mobile digeser turun supaya tidak ketutup
   * pita ImpersonationBanner. Lihat catatan sama di TeacherSidebar.tsx. */
  impersonating?: boolean;
  /* Sidebar ini dipakai DUA peran: staf TAS dan guru yang merangkap jabatan Tata Usaha. Tautan
     "Profil" & "Portal Guru" berbeda per peran — dulu dipilih dari `isFullTas`, yang justru
     terbalik: guru-TU (isFullTas true) tidak diberi tautan Portal Guru, sedangkan staf TAS non-TU
     diberi tautan portal guru yang tidak bisa mereka buka (verifyRole TEACHER/ADMIN → memantul ke
     /login). Sejak 28 September 2026 dipilih dari PERAN yang sebenarnya. */
  isGuru?: boolean;
}

export default function TasSidebar({ logoEmblem = "/images/logo-emblem.png", logoFullWhite, pendingProfileEdits = 0, overdueBooks = 0, jabatanNames = [], isFullTas = true, impersonating = false, isGuru = false }: TasSidebarProps) {
  const pathname = usePathname();
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
  const visibleGroups = menuGroupsTas
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
  // menutup yang sedang terbuka. Setiap awal login/muat halaman SEMUA grup tertutup kecuali grup
  // halaman aktif — sengaja tidak restore dari localStorage (keputusan eksplisit user).
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

  const q = search.trim().toLowerCase();
  const filteredGroups = visibleGroups
    .map(g => ({ ...g, items: q ? g.items.filter(i => i.label.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length > 0);

  const notifications = [
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
  ];

  // Bottom nav mobile — dibangun dari `visibleGroups` yang SAMA (sudah difilter jabatan/full),
  // supaya konsisten persis dgn apa yg boleh dilihat staf ini di desktop. 4 slot utama + Lainnya.
  function resolveBadge(item: RenderItem): number {
    return item.badgeKey === "pendingProfileEdits" ? pendingProfileEdits : item.badgeKey === "overdueBooks" ? overdueBooks : 0;
  }
  /* Bottom nav HP (18 Sep 2026): 4 tautan harian + tombol tengah Dashboard, TANPA sheet.
     Empat tautan Tata Usaha di bawah hanya untuk staf TU penuh. Staf TAS NON-TU (Kepala UKS, Tim
     Perpustakaan, Security, Kebersihan, …) TIDAK boleh diberi keempatnya: semuanya dijaga
     `verifyTasAccess()`, jadi setiap ketukan melempar mereka ke /login — dan karena di HP tidak
     ada sidebar sama sekali, portalnya jadi benar-benar buntu (laporan user 28 September 2026:
     empat dari lima akun TAS hanya melihat kartu sambutan). Untuk mereka slotnya diambil dari
     `visibleGroups` yang SUDAH disaring jabatan, persis seperti yang dijanjikan pola §3.6. */
  const navTataUsaha: ItemNavBawah[] = [
    { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk", icon: BookUser, simbol: "menu_book" },
    { href: "/dashboard/admin/persuratan", label: "Surat", icon: Archive, simbol: "mail" },
    { href: "/dashboard/admin/presensi-pegawai", label: "Presensi", icon: UserCheck, simbol: "badge" },
    { href: "/dashboard/admin/permintaan-surat", label: "Layanan", icon: ClipboardList, simbol: "assignment" },
  ];
  const navJabatan: ItemNavBawah[] = visibleGroups
    .flatMap(g => g.items)
    .filter(i => i.href !== "/dashboard/admin")
    .slice(0, 4)
    .map(i => ({ href: i.href, label: i.label, icon: i.icon, exact: i.exact }));
  /* Akun tanpa jabatan sama sekali: jangan jatuh ke menu TU (buntu lagi) — beri yang pasti bisa
     dibuka siapa pun. */
  const navUmum: ItemNavBawah[] = [
    { href: "/kartu-identitas", label: "Kartu", icon: QrCode, simbol: "badge" },
    { href: isGuru ? "/dashboard/teacher/profile" : "/dashboard/admin/profile", label: "Profil", icon: UserCog, simbol: "account_circle" },
  ];
  const navBawah: ItemNavBawah[] = isFullTas ? navTataUsaha : (navJabatan.length > 0 ? navJabatan : navUmum);

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
          isActive={isActive} pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} onLinkClick={() => {}}
        />
      </aside>

      <div className="lg:hidden print:hidden fixed left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg"
        style={impersonating ? { top: "var(--impersonation-banner-h, 2.5rem)" } : { top: 0 }}>
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
          {/* Satu pintu notifikasi (dulu kotak + lonceng terpisah). */}
          <KotakNotifikasiTombol variant="topbar" tindakan={notifications} />
          <MenuAkunMobile
            profilHref={isGuru ? "/dashboard/teacher/profile" : "/dashboard/admin/profile"}
            tautanTambahan={isGuru ? [{ href: "/dashboard/teacher", label: "Portal Guru", icon: ArrowLeft }] : []}
          />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/admin", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
