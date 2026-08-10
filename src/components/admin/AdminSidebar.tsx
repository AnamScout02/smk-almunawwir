"use client";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Image, Newspaper, GalleryHorizontal,
  ClipboardList, ClipboardCheck, NotebookPen, Users, MessageSquare, LogOut, Menu, X,
  Settings, FileText, School, UserCog, BookOpen, Globe, Briefcase, UserCircle, BarChart2, Bell, Calendar, Database, CalendarDays,
  Archive, Repeat, Mail, BookMarked, Clock, Users2, ShieldCheck, Award, Building2, ListChecks, Boxes,
  UserCheck, HeartPulse, Flag, Library, Network, BadgeCheck, FileQuestion, GraduationCap, Activity, CheckSquare, CalendarClock, History, Trophy, Sliders, FileCheck2, ShieldAlert, BookOpenCheck,
  ChevronDown, Search, IdCard,
} from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import NotificationBell from "@/components/shared/NotificationBell";

const COLLAPSE_KEY = "admin-sidebar-collapsed";
const OPEN_GROUPS_KEY = "admin-sidebar-open-groups";

// Grup dipecah lebih kecil & spesifik (dulu SEMUA 28 item ini numplek jadi satu grup "Akademik"
// raksasa — makin lama makin tidak rapi tiap kali fitur baru ditambah). Tiap grup sekarang
// collapsible (lihat toggleGroup di bawah), jadi sidebar tidak perlu discroll panjang-panjang lagi.
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
      { href: "/dashboard/admin/jabatan", label: "Jabatan", icon: Award, badge: 0 },
      { href: "/dashboard/admin/program-kerja", label: "Program Kerja", icon: ListChecks, badge: 0 },
    ],
  },
  {
    label: "Jadwal & Pengajaran",
    items: [
      { href: "/dashboard/admin/schedules", label: "Jadwal Pelajaran", icon: Calendar, badge: 0 },
      { href: "/dashboard/admin/subjects", label: "Kode Mata Pelajaran", icon: BookMarked, badge: 0 },
      { href: "/dashboard/admin/teaching-assignments", label: "Penugasan Mengajar", icon: Users2, badge: 0 },
      { href: "/dashboard/admin/school-periods", label: "Kerangka Jam Pelajaran", icon: Clock, badge: 0 },
    ],
  },
  {
    label: "Kehadiran & Nilai",
    items: [
      { href: "/dashboard/admin/absensi-jurnal", label: "Absensi & Jurnal Kelas", icon: ClipboardCheck, badge: 0 },
      { href: "/dashboard/admin/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare, badge: 0 },
      { href: "/dashboard/admin/poin-siswa", label: "Poin Siswa (Tata Tertib)", icon: ShieldAlert, badge: 0 },
      { href: "/dashboard/admin/tata-tertib", label: "Baca Tata Tertib Lengkap", icon: BookOpenCheck, badge: 0 },
      { href: "/dashboard/admin/jurnal-guru", label: "Jurnal Mengajar Guru", icon: NotebookPen, badge: 0 },
      { href: "/dashboard/admin/dkn", label: "DKN — Daftar Kumpulan Nilai", icon: ClipboardList, badge: 0 },
      { href: "/dashboard/admin/rpp", label: "Bank RPP", icon: BookMarked, badge: 0 },
      { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, badge: 0 },
    ],
  },
  {
    label: "Kedisiplinan & Kinerja",
    items: [
      { href: "/dashboard/admin/kedisiplinan-guru", label: "Kedisiplinan Guru", icon: BadgeCheck, badge: 0 },
      { href: "/dashboard/admin/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, badge: 0 },
      { href: "/dashboard/admin/kpi-indikator", label: "Pengaturan KPI", icon: Sliders, badge: 0 },
      { href: "/dashboard/admin/jadwal-piket", label: "Jadwal Piket", icon: CalendarClock, badge: 0 },
    ],
  },
  {
    label: "PKL & Karir",
    items: [
      { href: "/dashboard/admin/internships", label: "PKL", icon: Briefcase, badge: 0 },
      { href: "/dashboard/admin/pkl-pendaftaran", label: "Pendaftaran PKL", icon: FileCheck2, badge: 0 },
      { href: "/dashboard/admin/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, badge: 0 },
      { href: "/dashboard/admin/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, badge: 0 },
    ],
  },
  {
    label: "Sarana & Layanan Siswa",
    items: [
      { href: "/dashboard/admin/inventaris", label: "Inventaris Barang", icon: Boxes, badge: 0 },
      { href: "/dashboard/admin/uks", label: "UKS", icon: HeartPulse, badge: 0 },
      { href: "/dashboard/admin/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag, badge: 0 },
      { href: "/dashboard/admin/perpustakaan", label: "Perpustakaan", icon: Library, badge: 0 },
      { href: "/dashboard/admin/buku-saya", label: "Buku Saya", icon: BookOpen, badgeKey: "overdueBooks" as const },
      { href: "/dashboard/admin/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy, badge: 0 },
      { href: "/dashboard/admin/jaringan", label: "Jaringan Sekolah", icon: Network, badge: 0 },
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
      { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen, badge: 0 },
      { href: "/dashboard/admin/kartu-tanda", label: "Kartu Tanda", icon: IdCard, badge: 0 },
      { href: "/dashboard/admin/verifikasi-data", label: "Verifikasi Perubahan Data", icon: ShieldCheck, badgeKey: "pendingProfileEdits" as const },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/dashboard/admin/users", label: "Akun Pengguna", icon: Settings, badge: 0 },
      { href: "/dashboard/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarDays, badge: 0 },
      { href: "/dashboard/admin/master-data", label: "Master Data", icon: Database, badge: 0 },
      { href: "/dashboard/admin/cek-kelulusan", label: "Cek Kelulusan", icon: GraduationCap, badge: 0 },
      { href: "/dashboard/admin/reports", label: "Laporan & Ekspor", icon: BarChart2, badge: 0 },
      { href: "/dashboard/admin/performa-server", label: "Performa Server", icon: Activity, badge: 0 },
      { href: "/dashboard/admin/log-aktivitas", label: "Log Aktivitas", icon: History, badge: 0 },
      { href: "/dashboard/admin/profile", label: "Profil Admin", icon: UserCircle, badge: 0 },
    ],
  },
];

type BadgeKey = "pendingAdmissions" | "unreadMessages" | "pendingProfileEdits" | "overdueBooks";
type MenuGroup = typeof menuGroups[number];

function matchesPath(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
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
      </div>

      {/* Cari menu — filter cepat lintas grup, tidak perlu tahu menu itu ada di grup mana */}
      {!c && (
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
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/30 hover:text-white/60 uppercase transition-colors"
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
  logoEmblem?: string;
  logoFullWhite?: string;
}

export default function AdminSidebar({ unreadMessages = 0, pendingAdmissions = 0, pendingProfileEdits = 0, overdueBooks = 0, logoEmblem = "/images/logo-emblem.png", logoFullWhite }: AdminSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Accordion SATU-PER-SATU — buka grup lain otomatis menutup grup yang sedang terbuka (bukan
  // numpuk semua kebuka bareng). Muat preferensi grup terakhir dari sesi sebelumnya, TAPI grup
  // halaman yang lagi aktif selalu menang (menimpa preferensi tersimpan) — supaya tidak
  // membingungkan begitu halaman dibuka.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    const active = activeGroupLabel(window.location.pathname);
    if (active) { setOpenGroups(new Set([active])); return; }
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "[]"); } catch {}
    setOpenGroups(new Set(saved.slice(0, 1)));
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
    setOpenGroups(prev => {
      const next = prev.has(label) ? new Set<string>() : new Set([label]);
      localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const badges: Record<BadgeKey, number> = { unreadMessages, pendingAdmissions, pendingProfileEdits, overdueBooks };
  const notifications = [
    { label: "Pesan masuk belum dibaca", count: unreadMessages, href: "/dashboard/admin/messages" },
    { label: "Pendaftaran PPDB baru", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
  ];

  function getBadge(item: { badge?: number; badgeKey?: BadgeKey }): number {
    if ("badgeKey" in item && item.badgeKey) return badges[item.badgeKey] ?? 0;
    return 0;
  }

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
          pathname={pathname} getBadge={getBadge} onLinkClick={() => setOpen(false)}
        />
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
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent
              logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
              search={search} setSearch={setSearch}
              filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
              pathname={pathname} getBadge={getBadge} onLinkClick={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
