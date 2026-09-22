"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Image, Newspaper, GalleryHorizontal,
  ClipboardList, ClipboardCheck, NotebookPen, Users, MessageSquare, LogOut,
  Settings, FileText, School, UserCog, BookOpen, Globe, Briefcase, UserCircle, BarChart2, Bell, Calendar, CalendarCheck, Database, CalendarDays,
  Archive, Repeat, Mail, BookMarked, Clock, Users2, ShieldCheck, Award, Building2, ListChecks, Boxes,
  UserCheck, HeartPulse, Flag, Library, Network, BadgeCheck, FileQuestion, GraduationCap, Activity, CheckSquare, CalendarClock, History, Trophy, Sliders, FileCheck2, ShieldAlert, BookOpenCheck, HeartHandshake,
  ChevronDown, Search, IdCard, Heart, MoreHorizontal, ScanLine, Wallet, FileSpreadsheet,
  BookA, BookUser, Stamp, CalendarOff, HandCoins, ScanSearch,
  Forward, Send, Inbox, ClipboardSignature, Vote, LayoutGrid } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import { BellRing, DatabaseZap, QrCode, Siren, MessagesSquare, MessageSquareHeart, Hammer, ClipboardPen, BriefcaseBusiness, UserPlus, Camera, CircleHelp, Gauge, Wrench, FlaskConical, Megaphone, Home, Phone, Target, Handshake, Palette } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

const COLLAPSE_KEY = "admin-sidebar-collapsed";

// Grup disusun menurut ALUR KERJA sekolah (keputusan user 15 Sep 2026): data pokok → kurikulum → kehadiran →
// kesiswaan → kepegawaian → PKL → tata usaha → sarana → keuangan → website → sistem. Menu yang dipakai berurutan
// berada dalam satu grup. TasSidebar & bottom nav memakai nama grup yang sama — ubah bersamaan.
export const menuGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, badge: 0 },
    ],
  },
  {
    // DASHBOARD JABATAN — keputusan user 19 September 2026: superadmin bukan guru/pegawai tetapi
    // berakses penuh, jadi seluruh dashboard jabatan disediakan LENGKAP di portalnya sendiri
    // (komponen yang sama dengan portal guru, hanya shell-nya yang tetap admin).
    label: "Dashboard Jabatan",
    items: [
      { href: "/dashboard/admin/dashboard-jabatan/kepala-sekolah", label: "Dashboard Kepala Sekolah", icon: Gauge, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/kurikulum", label: "Dashboard Kurikulum", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/kesiswaan", label: "Dashboard Kesiswaan", icon: Users2, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/sarpras", label: "Dashboard Sarpras", icon: Wrench, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/penjamin-mutu", label: "Dashboard Penjamin Mutu", icon: ShieldCheck, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/kaprogli", label: "Dashboard Kaprogli", icon: Trophy, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/bk", label: "Dashboard BK", icon: HeartHandshake, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/bkk", label: "Dashboard BKK", icon: BriefcaseBusiness, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/operator", label: "Dashboard Operator", icon: DatabaseZap, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/uks", label: "Dashboard UKS", icon: HeartPulse, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/lab", label: "Dashboard Laboratorium", icon: FlaskConical, badge: 0 },
      { href: "/dashboard/admin/dashboard-jabatan/humas", label: "Dashboard Humas", icon: Megaphone, badge: 0 },
    ],
  },
  {
    label: "Data Siswa & Guru",
    items: [
      { href: "/dashboard/admin/admissions", label: "Pendaftaran", icon: ClipboardList, badgeKey: "pendingAdmissions" as const },
      { href: "/dashboard/admin/spmb-konversi", label: "SPMB → Buku Induk", icon: UserPlus, badge: 0 },
      { href: "/dashboard/admin/students", label: "Siswa", icon: Users, badge: 0 },
      { href: "/dashboard/admin/classes", label: "Kelas", icon: School, badge: 0 },
      { href: "/dashboard/admin/majors", label: "Jurusan", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/teachers", label: "Guru", icon: UserCog, badge: 0 },
      { href: "/dashboard/admin/jabatan", label: "Jabatan", icon: Award, badge: 0 },
      { href: "/dashboard/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarDays, badge: 0 },
    ],
  },
  {
    label: "Kurikulum & Pembelajaran",
    items: [
      { href: "/dashboard/admin/kalender-pendidikan", label: "Kalender Pendidikan", icon: CalendarDays, badge: 0 },
      { href: "/dashboard/admin/school-periods", label: "Kerangka Jam Pelajaran", icon: Clock, badge: 0 },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, badge: 0 },
      { href: "/dashboard/admin/teaching-assignments", label: "Penugasan Mengajar", icon: Users2, badge: 0 },
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, badge: 0 },
      { href: "/dashboard/admin/pemeriksa-jadwal", label: "Pemeriksa Jadwal", icon: CalendarCheck, badge: 0 },
      { href: "/dashboard/admin/rpp", label: "Bank RPP", icon: BookMarked, badge: 0 },
      { href: "/dashboard/admin/kelengkapan-perangkat", label: "Kelengkapan Perangkat Ajar", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/jurnal-guru", label: "Jurnal Mengajar Guru", icon: NotebookPen, badge: 0 },
      { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, badge: 0 },
      { href: "/dashboard/admin/form-nilai-rapor", label: "Form Nilai Rapor", icon: ClipboardPen, badge: 0 },
      { href: "/dashboard/admin/rapor-kelas", label: "Nilai & Rapor Kelas", icon: FileCheck2, badge: 0 },
      { href: "/dashboard/admin/dkn", label: "DKN — Daftar Kumpulan Nilai", icon: ClipboardList, badge: 0 },
      { href: "/dashboard/admin/pengesahan-rapor", label: "Pengesahan Rapor", icon: FileCheck2, badge: 0 },
      { href: "/dashboard/admin/rekap-ukk", label: "Rekap UKK", icon: Award, badge: 0 },
    ],
  },
  {
    label: "Kehadiran Siswa",
    items: [
      { href: "/dashboard/admin/absensi-jurnal", label: "Absensi & Jurnal Kelas", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare, badge: 0 },
      { href: "/dashboard/admin/izin-siswa", label: "Izin / Sakit Siswa", icon: CalendarOff, badge: 0 },
      { href: "/dashboard/admin/piket-kelas", label: "Jadwal Piket Kelas", icon: ListChecks, badge: 0 },
      { href: "/dashboard/admin/absensi-siswa/scan", label: "Absensi Scan QR/Barcode", icon: ScanLine, badge: 0 },
      { href: "/dashboard/admin/absensi-siswa/qr-mandiri", label: "Layar QR Absen Mandiri", icon: QrCode, badge: 0 },
    ],
  },
  {
    label: "Kesiswaan & BK",
    items: [
      { href: "/dashboard/admin/papan-kesiswaan", label: "Papan Kesiswaan", icon: Activity, badge: 0 },
      { href: "/dashboard/admin/poin-siswa", label: "Poin Siswa (Tata Tertib)", icon: ShieldAlert, badge: 0 },
      { href: "/dashboard/admin/panggilan-ortu", label: "Panggilan Orang Tua", icon: Mail, badge: 0 },
      { href: "/dashboard/admin/pemilihan-osis", label: "Pemilihan OSIS", icon: Vote, badge: 0 },
      { href: "/dashboard/admin/tata-tertib", label: "Baca Tata Tertib Lengkap", icon: BookOpenCheck, badge: 0 },
      { href: "/dashboard/admin/rekam-bk", label: "Rekam BK — Penanganan Siswa", icon: HeartHandshake, badge: 0 },
      { href: "/dashboard/admin/kunjungan-rumah", label: "Kunjungan Rumah", icon: Home, badge: 0 },
      { href: "/dashboard/admin/kesehatan-siswa", label: "Kesehatan Siswa", icon: HeartPulse, badge: 0 },
      { href: "/dashboard/admin/kontak-ortu", label: "Kontak Orang Tua", icon: Phone, badge: 0 },
      { href: "/dashboard/admin/konseling", label: "Janji Konseling", icon: MessagesSquare, badge: 0 },
      { href: "/dashboard/admin/aspirasi", label: "Kotak Aspirasi Siswa", icon: MessageSquareHeart, badge: 0 },
      { href: "/dashboard/admin/peringatan-dini", label: "Peringatan Dini Siswa", icon: Siren, badge: 0 },
      { href: "/dashboard/admin/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag, badge: 0 },
      { href: "/dashboard/admin/absen-ekstra", label: "Absen Ekstra", icon: CheckSquare, badge: 0 },
      { href: "/dashboard/admin/uks", label: "UKS", icon: HeartPulse, badge: 0 },
      { href: "/dashboard/admin/bantuan-siswa", label: "Bantuan & Beasiswa", icon: HandCoins, badge: 0 },
    ],
  },
  {
    label: "Kepegawaian & Kinerja",
    items: [
      { href: "/dashboard/admin/tugas", label: "Papan Tugas", icon: ClipboardList, badge: 0 },
      { href: "/dashboard/admin/pkb", label: "Portofolio PKB", icon: Award, badge: 0 },
      { href: "/dashboard/admin/presensi-pegawai", label: "Presensi Pegawai", icon: UserCheck, badge: 0 },
      { href: "/dashboard/admin/kegiatan", label: "Presensi Kegiatan (QR)", icon: CalendarCheck, badge: 0 },
      { href: "/dashboard/admin/supervisi", label: "Supervisi & PKG", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/arsip-sk", label: "Arsip SK & Dokumen", icon: Archive, badge: 0 },
      { href: "/dashboard/admin/cuti", label: "Cuti Pegawai", icon: CalendarOff, badge: 0 },
      { href: "/dashboard/admin/jadwal-piket", label: "Jadwal Piket", icon: CalendarClock, badge: 0 },
      { href: "/dashboard/admin/kedisiplinan-guru", label: "Kedisiplinan Guru", icon: BadgeCheck, badge: 0 },
      { href: "/dashboard/admin/buku-piket", label: "Buku Piket Harian", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/kinerja-pimpinan", label: "Kinerja Pimpinan (KPI)", icon: Target, badge: 0 },
      { href: "/dashboard/admin/kehadiran-guru", label: "Kehadiran Guru Terpadu", icon: UserCheck, badge: 0 },
      { href: "/dashboard/admin/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, badge: 0 },
      { href: "/dashboard/admin/kpi-indikator", label: "Pengaturan KPI", icon: Sliders, badge: 0 },
      { href: "/dashboard/admin/program-kerja", label: "Program Kerja", icon: ListChecks, badge: 0 },
    ],
  },
  {
    label: "PKL & Alumni",
    items: [
      { href: "/dashboard/admin/pkl-pendaftaran", label: "Pendaftaran PKL", icon: FileCheck2, badge: 0 },
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, badge: 0 },
      { href: "/dashboard/admin/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, badge: 0 },
      { href: "/dashboard/admin/mitra-mou", label: "Status MoU Mitra", icon: Handshake, badge: 0 },
      { href: "/dashboard/admin/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, badge: 0 },
      { href: "/dashboard/admin/lowongan", label: "Lowongan Kerja BKK", icon: BriefcaseBusiness, badge: 0 },
    ],
  },
  {
    label: "TU — Buku Induk & Data",
    items: [
      { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog, badge: 0 },
      { href: "/dashboard/admin/buku-klapper", label: "Buku Klapper", icon: BookA, badge: 0 },
      { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat, badge: 0 },
      { href: "/dashboard/admin/kenaikan-kelas", label: "Buku Kenaikan Kelas", icon: GraduationCap, badge: 0 },
      { href: "/dashboard/admin/verifikasi-data", label: "Verifikasi Perubahan Data", icon: ShieldCheck, badgeKey: "pendingProfileEdits" as const },
      { href: "/dashboard/admin/pemeriksa-data", label: "Pemeriksa Data", icon: ScanSearch, badge: 0 },
      { href: "/dashboard/admin/dapodik", label: "Sinkron Dapodik", icon: DatabaseZap, badge: 0 },
    ],
  },
  {
    label: "TU — Persuratan",
    items: [
      { href: "/dashboard/admin/persuratan", label: "Agenda Surat", icon: Mail, badge: 0 },
      { href: "/dashboard/admin/disposisi", label: "Disposisi Surat Masuk", icon: Forward, badgeKey: "belumDisposisi" as const },
      { href: "/dashboard/admin/ekspedisi", label: "Buku Ekspedisi", icon: Send, badge: 0 },
      { href: "/dashboard/admin/permintaan-surat", label: "Permintaan Surat", icon: Inbox, badgeKey: "permintaanSurat" as const },
      { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen, badge: 0 },
      { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive, badge: 0 },
    ],
  },
  {
    label: "TU — Layanan & Dokumen",
    items: [
      { href: "/dashboard/admin/rapor-siswa", label: "Penerimaan Rapor", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/cek-kelulusan", label: "Cek Kelulusan", icon: GraduationCap, badge: 0 },
      { href: "/dashboard/admin/ijazah-serah", label: "Penyerahan Ijazah", icon: GraduationCap, badge: 0 },
      { href: "/dashboard/admin/legalisir", label: "Legalisir Dokumen", icon: Stamp, badge: 0 },
      { href: "/dashboard/admin/kartu-tanda", label: "Kartu Tanda", icon: IdCard, badge: 0 },
      { href: "/dashboard/admin/buku-tamu", label: "Buku Tamu", icon: BookUser, badge: 0 },
      { href: "/dashboard/admin/nominatif", label: "Nominatif Kelas XII", icon: FileSpreadsheet, badge: 0 },
      { href: "/dashboard/admin/profil-sekolah", label: "Profil Sekolah", icon: Building2, badge: 0 },
      { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, badge: 0 },
    ],
  },
  {
    label: "Sarana & Perpustakaan",
    items: [
      { href: "/dashboard/admin/inventaris", label: "Inventaris Barang", icon: Boxes, badge: 0 },
      { href: "/dashboard/admin/layanan-sarpras", label: "Layanan Sarpras", icon: Hammer, badge: 0 },
      { href: "/dashboard/admin/usulan-alat", label: "Usulan Alat & Bahan", icon: Boxes, badge: 0 },
      { href: "/pusat-perpustakaan", label: "Pusat Perpustakaan", icon: Library, badge: 0 },
      { href: "/perpustakaan", label: "Perpustakaan Digital", icon: BookOpen, badge: 0 },
      { href: "/dashboard/admin/buku-saya", label: "Buku Saya", icon: BookOpen, badgeKey: "overdueBooks" as const },
      { href: "/dashboard/admin/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy, badge: 0 },
      { href: "/dashboard/admin/jaringan", label: "Jaringan Sekolah", icon: Network, badge: 0 },
      { href: "/dashboard/admin/bel-sekolah", label: "Bel Sekolah Otomatis", icon: Bell, badge: 0 },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { href: "/dashboard/bendahara", label: "Bendahara", icon: Wallet, badge: 0 },
    ],
  },
  {
    label: "Website & Informasi",
    items: [
      { href: "/dashboard/admin/announcements", label: "Pengumuman", icon: Bell, badge: 0 },
      { href: "/dashboard/admin/survei", label: "Survei & Angket", icon: ClipboardPen, badge: 0 },
      { href: "/dashboard/admin/liputan", label: "Usulan Liputan", icon: Camera, badge: 0 },
      { href: "/dashboard/admin/bantuan", label: "Pusat Bantuan (tiket)", icon: CircleHelp, badge: 0 },
      { href: "/dashboard/admin/messages", label: "Pesan Masuk", icon: MessageSquare, badgeKey: "unreadMessages" as const },
      { href: "/dashboard/admin/news", label: "Berita", icon: Newspaper, badge: 0 },
      { href: "/dashboard/admin/branding", label: "Branding & Identitas", icon: Palette, badge: 0 },
      { href: "/dashboard/admin/gallery", label: "Galeri Foto", icon: GalleryHorizontal, badge: 0 },
      { href: "/dashboard/admin/banners", label: "Banner / Hero", icon: Image, badge: 0 },
      { href: "/dashboard/admin/content", label: "Konten Halaman", icon: FileText, badge: 0 },
    ],
  },
  {
    label: "Sistem & Akun",
    items: [
      { href: "/dashboard/admin/users", label: "Akun Pengguna", icon: Settings, badge: 0 },
      { href: "/dashboard/admin/parents", label: "Akun Orang Tua", icon: Heart, badge: 0 },
      { href: "/dashboard/admin/master-data", label: "Master Data", icon: Database, badge: 0 },
      { href: "/dashboard/admin/keamanan-sesi", label: "Keamanan & Sesi Login", icon: ShieldCheck, badge: 0 },
      { href: "/dashboard/admin/notifikasi", label: "Notifikasi Push", icon: BellRing, badge: 0 },
      { href: "/dashboard/admin/log-aktivitas", label: "Log Aktivitas", icon: History, badge: 0 },
      { href: "/dashboard/admin/performa-server", label: "Performa Server", icon: Activity, badge: 0 },
      { href: "/dashboard/admin/absen-mandiri", label: "Presensi Mandiri", icon: QrCode, badge: 0 },
      { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard, badge: 0 },
      { href: "/dashboard/admin/profile", label: "Profil Admin", icon: UserCircle, badge: 0 },
    ],
  },
];

type BadgeKey = "pendingAdmissions" | "unreadMessages" | "pendingProfileEdits" | "overdueBooks" | "permintaanSurat" | "belumDisposisi";
type MenuGroup = typeof menuGroups[number];

const ALL_HREFS = menuGroups.flatMap(g => g.items.map(i => i.href));

// PERBAIKAN 2026-08-10 (temuan user, screenshot: 2 menu ke-highlight bersamaan) — kalau href
// menu A jadi prefix dari href menu B (mis. "/x/ekstrakurikuler" vs "/x/ekstrakurikuler/absensi"),
// dulu KEDUANYA dianggap aktif krn masing2 dicek independen via startsWith. Sekarang hanya href
// PALING SPESIFIK (terpanjang) yg match dianggap aktif.
function matchesPath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  if (pathname !== href && !pathname.startsWith(href + "/")) return false;
  const moreSpecific = ALL_HREFS.some(h => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + "/")));
  return !moreSpecific;
}

/** Grup yang memuat halaman aktif — dipakai supaya grup itu OTOMATIS terbuka (biar user tidak
 * "kesasar" masuk ke halaman yang grupnya kebetulan lagi tertutup). */
function activeGroupLabel(pathname: string): string | null {
  for (const g of menuGroups) {
    if (!g.label) continue;
    if (g.items.some(item => matchesPath(pathname, item.href, "exact" in item ? !!item.exact : false))) {
      return g.label;
    }
  }
  return null;
}

interface SidebarContentProps {
  collapsed?: boolean;
  onToggle?: () => void;
  logoEmblem: string;
  logoFullWhite?: string;
  search: string;
  setSearch: (v: string) => void;
  filteredGroups: MenuGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  pathname: string;
  getBadge: (item: { badge?: number; badgeKey?: BadgeKey }) => number;
  onLinkClick: () => void;
}

// Komponen TERPISAH di luar AdminSidebar (bukan didefinisikan ulang di dalam body tiap render) —
// kalau didefinisikan di dalam, React menganggapnya "tipe komponen baru" setiap kali parent
// re-render (misal tiap ketikan di kotak pencarian), jadi seluruh sidebar dibongkar-pasang ulang
// dan input kehilangan fokus setelah 1 huruf. Ini penyebab bug "harus klik lagi tiap huruf" yang
// dilaporkan user — komponen ini HARUS didefinisikan di luar (identitas fungsinya stabil antar
// render) supaya React cuma update DOM yang berubah, bukan remount semuanya.
function SidebarContent({
  collapsed: c = false, onToggle, logoEmblem, logoFullWhite,
  search, setSearch, filteredGroups, openGroups, toggleGroup, pathname, getBadge, onLinkClick,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo — klik untuk buka/tutup sidebar (desktop) */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          title={onToggle ? (c ? "Buka sidebar" : "Tutup sidebar") : undefined}
          className={`text-left min-w-0 flex-1 ${onToggle ? "hover:opacity-80 cursor-pointer" : "cursor-default"} transition-opacity`}
        >
          {c ? (
            <div className="flex justify-center">
              <NextImage src={logoEmblem} alt="Logo" width={32} height={32} className="rounded-full object-contain shrink-0" />
            </div>
          ) : logoFullWhite ? (
            <div className="flex flex-col gap-1.5">
              <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" />
              <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Panel Admin</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <NextImage src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" />
              <div>
                <p className="font-heading font-bold text-white text-sm leading-tight">Al Munawwir</p>
                <p className="text-white/50 text-xs">Panel Admin</p>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Cari menu — filter cepat lintas grup, tidak perlu tahu menu itu ada di grup mana */}
      {!c && (
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
      )}

      {/* Menu */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scroll space-y-1">
        {filteredGroups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-white/30">Tidak ada menu yang cocok.</p>
        )}
        {filteredGroups.map((group) => {
          const isRoot = group.label === null;
          const isOpen = isRoot || !!search.trim() || c || openGroups.has(group.label!);
          return (
          <div key={group.label ?? "__root__"} className={isRoot ? "" : "pt-2"}>
            {group.label && !c && (
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
                  const active = matchesPath(pathname, item.href, "exact" in item ? (item as { exact?: boolean }).exact ?? false : false);
                  const badgeCount = getBadge(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onLinkClick}
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
            )}
          </div>
          );
        })}
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
}

interface AdminSidebarProps {
  unreadMessages?: number;
  pendingAdmissions?: number;
  pendingProfileEdits?: number;
  overdueBooks?: number;
  missingAttendanceClasses?: number;
  /** Permintaan surat dari portal siswa/orang tua yang masih menunggu diproses. */
  permintaanSurat?: number;
  /** Surat masuk yang tercatat di Persuratan tapi belum pernah didisposisikan. */
  belumDisposisi?: number;
  logoEmblem?: string;
  logoFullWhite?: string;
  /** Admin sedang "Masuk Sebagai" akun ini — topbar mobile digeser turun supaya tidak ketutup
   * pita ImpersonationBanner. Lihat catatan sama di TeacherSidebar.tsx. */
  impersonating?: boolean;
}

export default function AdminSidebar({ unreadMessages = 0, pendingAdmissions = 0, pendingProfileEdits = 0, overdueBooks = 0, missingAttendanceClasses = 0, permintaanSurat = 0, belumDisposisi = 0, logoEmblem = "/images/logo-emblem.png", logoFullWhite, impersonating = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Accordion SATU-PER-SATU — buka grup lain otomatis menutup grup yang sedang terbuka (bukan
  // numpuk semua kebuka bareng). Setiap awal login/muat halaman, SEMUA grup WAJIB tertutup
  // kecuali grup halaman yang sedang aktif — sengaja TIDAK me-restore preferensi grup terbuka
  // dari sesi sebelumnya (localStorage), supaya sidebar selalu mulai rapi & konsisten. Keputusan
  // eksplisit user — jangan tambah restore-from-localStorage lagi di sini.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    const active = activeGroupLabel(window.location.pathname);
    setOpenGroups(active ? new Set([active]) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tiap kali pindah halaman, grup halaman yang baru jadi SATU-SATUNYA yang terbuka.
  useEffect(() => {
    const active = activeGroupLabel(pathname);
    if (!active) return;
    setOpenGroups(new Set([active]));
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleGroup(label: string) {
    setOpenGroups(prev => (prev.has(label) ? new Set<string>() : new Set([label])));
  }

  const badges: Record<BadgeKey, number> = { unreadMessages, pendingAdmissions, pendingProfileEdits, overdueBooks, permintaanSurat, belumDisposisi };
  const notifications = [
    { label: "Pesan masuk belum dibaca", count: unreadMessages, href: "/dashboard/admin/messages" },
    { label: "Pendaftaran PPDB baru", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
    { label: "Kelas belum absen hari ini", count: missingAttendanceClasses, href: "/dashboard/admin/absensi-siswa" },
    { label: "Permintaan surat menunggu diproses", count: permintaanSurat, href: "/dashboard/admin/permintaan-surat" },
    { label: "Surat masuk belum didisposisi", count: belumDisposisi, href: "/dashboard/admin/disposisi" },
  ];

  function getBadge(item: { badge?: number; badgeKey?: BadgeKey }): number {
    if ("badgeKey" in item && item.badgeKey) return badges[item.badgeKey] ?? 0;
    return 0;
  }

  // Bottom nav HP (18 Sep 2026): 4 tautan harian + tombol tengah Dashboard, TANPA sheet.
  const navBawah: ItemNavBawah[] = [
    { href: "/dashboard/admin/students", label: "Siswa", icon: GraduationCap, simbol: "school" },
    { href: "/dashboard/admin/absensi-siswa", label: "Absensi", icon: ClipboardCheck, simbol: "fact_check", badge: missingAttendanceClasses },
    { href: "/dashboard/admin/teachers", label: "Guru", icon: UserCog, simbol: "badge" },
    { href: "/dashboard/admin/persuratan", label: "Surat", icon: Archive, simbol: "mail", badge: belumDisposisi },
  ];

  const q = search.trim().toLowerCase();
  const filteredGroups = (menuGroups
    .map(g => ({ ...g, items: q ? g.items.filter(i => i.label.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length > 0)) as MenuGroup[];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col ${collapsed ? "w-[76px]" : "w-60"} bg-primary-900 h-screen sticky top-0 shrink-0 relative overflow-hidden print:hidden transition-[width] duration-200`}>
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent
          collapsed={collapsed} onToggle={toggleCollapsed}
          logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
          search={search} setSearch={setSearch}
          filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
          pathname={pathname} getBadge={getBadge} onLinkClick={() => {}}
        />
      </aside>

      {/* Mobile: top bar SLIM (logo + notifikasi) — navigasi sepenuhnya di bottom nav bar, tidak
          ada lagi hamburger/drawer (keputusan eksplisit user 2026-08-22: ganti total). */}
      <div className="lg:hidden print:hidden fixed left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg"
        style={impersonating ? { top: "var(--impersonation-banner-h, 2.5rem)" } : { top: 0 }}>
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <NextImage src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" />
          ) : (
            <>
              <NextImage src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" />
              <span className="font-heading font-bold text-white text-sm">Admin Panel</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Satu pintu notifikasi (dulu kotak + lonceng terpisah). */}
          <KotakNotifikasiTombol variant="topbar" tindakan={notifications} />
          <MenuAkunMobile profilHref="/dashboard/admin/profile" />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/admin", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
