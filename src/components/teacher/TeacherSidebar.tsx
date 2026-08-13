"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, Users, LogOut, Menu, X, Globe, UserCircle, Calendar, NotebookPen, Briefcase, BookOpen, Gauge, GraduationCap, Award, HeartHandshake, Building2, ListChecks, ShieldCheck, ShieldAlert, BadgeCheck, UserCheck, Megaphone, Database, Wrench, Boxes, FlaskConical, HeartPulse, Flag, Library, Network, FileQuestion, BookMarked, Users2, CalendarClock, UserCog, Repeat, Mail, Archive, Trophy, FileCheck2, Search, BookOpenCheck, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";

interface MenuItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number }
interface MenuGroup { label: string | null; items: MenuItem[] }

interface SidebarContentProps {
  logoEmblem: string;
  logoFullWhite?: string;
  search: string;
  setSearch: (v: string) => void;
  filteredGroups: MenuGroup[];
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
  onLinkClick: () => void;
}

// Komponen TERPISAH di luar TeacherSidebar (bukan didefinisikan ulang di dalam body tiap render) —
// lihat komentar lengkap di AdminSidebar.tsx: kalau didefinisikan di dalam, React membongkar-pasang
// ulang seluruh sidebar tiap ketikan di kotak pencarian, bikin input kehilangan fokus tiap huruf.
// PERBAIKAN 2026-08-11 (keputusan eksplisit user, membalik keputusan lama "sengaja tetap flat") —
// menu portal Guru sekarang DIKELOMPOKKAN + accordion, sama seperti AdminSidebar/TasSidebar,
// karena daftar menu sudah berkembang jauh lebih panjang dari waktu keputusan lama dibuat.
function SidebarContent({ logoEmblem, logoFullWhite, search, setSearch, filteredGroups, openGroups, toggleGroup, isActive, onLinkClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/10">
        {logoFullWhite ? (
          <div className="flex flex-col gap-1.5">
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={48} className="object-contain h-10 w-auto" unoptimized />
            <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Portal Guru</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Image src={logoEmblem} alt="Logo" width={36} height={36} className="rounded-full object-contain shrink-0" unoptimized />
            <div>
              <p className="font-heading font-bold text-white text-sm">Al Munawwir</p>
              <p className="text-white/50 text-xs">Portal Guru</p>
            </div>
          </div>
        )}
      </div>

      {/* Cari menu — berguna kalau guru merangkap banyak jabatan */}
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
        {filteredGroups.map(group => {
          const isRoot = group.label === null;
          const isOpen = isRoot || !!search.trim() || openGroups.has(group.label!);
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
                    const badgeCount = item.badge ?? 0;
                    return (
                      <Link key={item.href} href={item.href} onClick={onLinkClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                        <item.icon size={17} />
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"}`}>
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

interface TeacherSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  jabatanNames?: string[];
  hasInternshipBimbingan?: boolean;
  isGuruPiketOnDutyToday?: boolean;
  overdueBooks?: number;
  hasHomeroom?: boolean;
}

export default function TeacherSidebar({
  logoEmblem = "/images/logo-emblem.png", logoFullWhite, jabatanNames = [], hasInternshipBimbingan = false,
  isGuruPiketOnDutyToday = false, overdueBooks = 0, hasHomeroom = false,
}: TeacherSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const isKepalaSekolah = jabatanNames.includes("Kepala Sekolah");
  const isWakasekHumas = jabatanNames.includes("Wakil Kepala Humas");
  const isWakasekKurikulum = jabatanNames.includes("Wakil Kepala Kurikulum");
  const isKaprogli = jabatanNames.some(n => n.startsWith("Kepala Kompetensi Keahlian "));
  const isGuruBk = jabatanNames.includes("Guru BK");
  const isWakasekKesiswaan = jabatanNames.includes("Wakil Kepala Kesiswaan");
  const isWakasekPenjaminMutu = jabatanNames.includes("Wakil Kepala Bidang Penjamin Mutu");
  const isGuruPiket = jabatanNames.includes("Guru Piket");
  const isWakasekSarpras = jabatanNames.includes("Wakil Kepala Sarana Prasarana");
  const isKoordinatorBkk = jabatanNames.includes("Koordinator BKK");
  const isKoordinatorBranding = jabatanNames.includes("Koordinator Tim Branding & Publikasi");
  const isOperatorSekolah = jabatanNames.includes("Operator Sekolah");
  const isKepalaLab = jabatanNames.includes("Kepala Laboratorium");
  const isKepalaUks = jabatanNames.includes("Kepala UKS");
  const isPembinaOsis = jabatanNames.includes("Pembina OSIS");
  const isPembinaPramuka = jabatanNames.includes("Pembina Pramuka");
  const isKoordinatorEkstrakurikuler = jabatanNames.includes("Koordinator Ekstrakurikuler");
  const isPerpustakaan = jabatanNames.includes("Koordinator Perpustakaan") || jabatanNames.includes("Tim Perpustakaan");
  const isPengelolaJaringan = jabatanNames.includes("Pengelola Jaringan Sekolah");
  // Guru yang MERANGKAP jabatan Tenaga Administrasi Sekolah (lihat tas-access-guard.ts) — halaman
  // Tata Usaha ini masih hidup di bawah /dashboard/admin/* (bukan diduplikasi ke /dashboard/teacher/*),
  // jadi menu di sini sengaja link LANGSUNG ke sana. Layout admin (+ setiap API-nya) sudah dibenahi
  // supaya role TEACHER berjabatan ini diloloskan verifyTasAccess().
  const isTasStaff = jabatanNames.includes("Tenaga Administrasi Sekolah") || jabatanNames.includes("Kepala Tenaga Administrasi Sekolah");

  const ekstrakurikulerAccess = isPembinaOsis || isPembinaPramuka || isKoordinatorEkstrakurikuler;
  const kesiswaanBkAccess = isWakasekKesiswaan || isGuruBk;

  const menuGroups: MenuGroup[] = [
    {
      label: null,
      items: [{ href: "/dashboard/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Dashboard Jabatan",
      items: [
        ...(isKepalaSekolah ? [{ href: "/dashboard/teacher/kepala-sekolah", label: "Dashboard Kepala Sekolah", icon: Gauge }] : []),
        ...(isWakasekKurikulum ? [{ href: "/dashboard/teacher/wakasek/kurikulum", label: "Dashboard Kurikulum", icon: GraduationCap }] : []),
        ...(isWakasekKesiswaan ? [{ href: "/dashboard/teacher/wakasek/kesiswaan", label: "Dashboard Kesiswaan", icon: ShieldCheck }] : []),
        ...(isWakasekSarpras ? [{ href: "/dashboard/teacher/wakasek/sarpras", label: "Dashboard Sarpras", icon: Wrench }] : []),
        ...(isWakasekPenjaminMutu ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu", label: "Dashboard Penjamin Mutu", icon: BadgeCheck }] : []),
        ...(isKaprogli ? [{ href: "/dashboard/teacher/wakasek/kaprogli", label: "Dashboard Kaprogli", icon: Award }] : []),
        ...(isGuruBk ? [{ href: "/dashboard/teacher/bk", label: "Dashboard BK", icon: HeartHandshake }] : []),
        ...(isKoordinatorBkk ? [{ href: "/dashboard/teacher/bkk", label: "Dashboard BKK", icon: UserCheck }] : []),
        ...(isKoordinatorBranding ? [{ href: "/dashboard/teacher/branding", label: "Dashboard Branding & Publikasi", icon: Megaphone }] : []),
        ...(isOperatorSekolah ? [{ href: "/dashboard/teacher/operator", label: "Dashboard Operator Sekolah", icon: Database }] : []),
        ...(isKepalaUks ? [{ href: "/dashboard/teacher/uks", label: "Dashboard UKS", icon: HeartPulse }] : []),
      ],
    },
    {
      label: "Jadwal & Pengajaran",
      items: [
        ...(isWakasekKurikulum ? [
          { href: "/dashboard/teacher/wakasek/kurikulum/jadwal", label: "Jadwal Pelajaran", icon: Calendar },
          { href: "/dashboard/teacher/wakasek/kurikulum/mapel", label: "Kode Mata Pelajaran", icon: BookMarked },
          { href: "/dashboard/teacher/wakasek/kurikulum/penugasan", label: "Penugasan Mengajar", icon: Users2 },
        ] : []),
        { href: "/dashboard/teacher/schedule", label: "Jadwal Saya", icon: Calendar },
        { href: "/dashboard/teacher/journal", label: "Jurnal Mengajar", icon: NotebookPen },
        { href: "/dashboard/teacher/rpp", label: "Bank RPP", icon: NotebookPen },
        { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion },
      ],
    },
    {
      label: "Kehadiran, Nilai & Siswa",
      items: [
        { href: "/dashboard/teacher/students", label: "Daftar Siswa", icon: Users },
        ...(hasHomeroom ? [
          { href: "/dashboard/teacher/attendance", label: "Absensi", icon: CheckSquare },
          { href: "/dashboard/teacher/dkn", label: "DKN Kelas", icon: ClipboardList },
        ] : []),
        { href: "/dashboard/teacher/materials", label: "Materi & Tugas", icon: BookOpen },
        // Read-only. Kesiswaan/BK lintas kelas (bukan cuma kelas wali) — butuh pantau kehadiran
        // siswa sekolah utk keperluan pembinaan/konseling. Wali kelas biasa (bukan Kesiswaan/BK)
        // tetap dapat menu ini tapi dibatasi ke kelas walinya sendiri (lihat AbsensiSiswaManager
        // classesEndpoint). Input absensi resmi tetap khusus wali kelas lewat menu Absensi di atas.
        ...(kesiswaanBkAccess
          ? [{ href: "/dashboard/teacher/kesiswaan/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare }]
          : hasHomeroom
          ? [{ href: "/dashboard/teacher/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare }]
          : []),
      ],
    },
    {
      label: "Kedisiplinan & Kinerja",
      items: [
        { href: "/dashboard/teacher/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy },
        { href: "/dashboard/teacher/kinerja", label: "Kinerja Saya", icon: Award },
        ...((isWakasekPenjaminMutu || isWakasekKurikulum || isGuruPiketOnDutyToday) ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan", label: "Kedisiplinan Guru", icon: BadgeCheck }] : []),
        ...((isWakasekPenjaminMutu || isGuruPiket) ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu/jadwal-piket", label: "Jadwal Piket", icon: CalendarClock }] : []),
        // Poin Siswa (Tata Tertib) — akses PENUH khusus Wakasek Kesiswaan & Guru BK. Guru Piket
        // (siapa pun terjadwal piket HARI INI, bukan jabatan tetap) dapat menu terbatas terpisah,
        // cuma boleh catat Terlambat & seragam/atribut (lihat kesiswaan-guard.ts).
        ...(kesiswaanBkAccess ? [
          { href: "/dashboard/teacher/kesiswaan/poin-siswa", label: "Poin Siswa", icon: ShieldAlert },
          { href: "/dashboard/teacher/kesiswaan/rekam-bk", label: "Rekam BK — Penanganan Siswa", icon: HeartHandshake },
        ] : []),
        ...(isGuruPiketOnDutyToday && !kesiswaanBkAccess ? [{ href: "/dashboard/teacher/piket/poin-siswa", label: "Catat Poin Siswa (Piket)", icon: ShieldAlert }] : []),
        { href: "/dashboard/teacher/tata-tertib", label: "Tata Tertib Peserta Didik", icon: BookOpenCheck },
      ],
    },
    {
      label: "PKL & Karir",
      items: [
        ...(hasInternshipBimbingan ? [{ href: "/dashboard/teacher/pkl", label: "PKL Pembimbingan", icon: Briefcase }] : []),
        ...(isWakasekHumas ? [
          { href: "/dashboard/teacher/humas/pkl-pendaftaran", label: "Pendaftaran PKL", icon: FileCheck2 },
          { href: "/dashboard/teacher/humas/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2 },
          { href: "/dashboard/teacher/humas/tracer-study", label: "Tracer Study Alumni", icon: UserCheck },
        ] : []),
        ...(isKepalaSekolah ? [{ href: "/dashboard/teacher/kepala-sekolah/mitra", label: "Peta Kemitraan Industri", icon: Building2 }] : []),
      ],
    },
    {
      label: "Sarana & Layanan Siswa",
      items: [
        ...(isWakasekSarpras ? [{ href: "/dashboard/teacher/wakasek/sarpras/inventaris", label: "Inventaris Barang", icon: Boxes }] : []),
        ...(ekstrakurikulerAccess ? [
          { href: "/dashboard/teacher/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag },
          { href: "/dashboard/teacher/absen-ekstra", label: "Absen Ekstra", icon: CheckSquare },
        ] : []),
        ...(isKepalaLab ? [{ href: "/dashboard/teacher/lab/inventaris", label: "Inventaris Lab", icon: FlaskConical }] : []),
        ...(isPerpustakaan ? [{ href: "/dashboard/teacher/perpustakaan", label: "Perpustakaan", icon: Library }] : []),
        { href: "/dashboard/teacher/buku-saya", label: "Buku Saya", icon: BookOpen, badge: overdueBooks },
        { href: "/dashboard/teacher/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy },
        ...(isPengelolaJaringan ? [{ href: "/dashboard/teacher/jaringan", label: "Jaringan Sekolah", icon: Network }] : []),
      ],
    },
    ...(isTasStaff ? [{
      label: "Tata Usaha",
      items: [
        { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen },
        { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog },
        { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat },
        { href: "/dashboard/admin/persuratan", label: "Persuratan", icon: Mail },
        { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive },
        { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen },
        { href: "/dashboard/admin/verifikasi-data", label: "Verifikasi Perubahan Data", icon: ShieldCheck },
      ],
    }] : []),
    {
      label: "Lainnya",
      items: [
        ...(jabatanNames.length > 0 ? [{ href: "/dashboard/teacher/program-kerja", label: "Program Kerja", icon: ListChecks }] : []),
        { href: "/dashboard/teacher/profile", label: "Profil Saya", icon: UserCircle },
      ],
    },
  ].map(g => ({ ...g, items: g.items.map(i => ({ ...i, badge: "badge" in i ? i.badge : undefined })) })) as MenuGroup[];

  const visibleGroups = menuGroups.filter(g => g.items.length > 0);
  const ALL_HREFS = visibleGroups.flatMap(g => g.items.map(i => i.href));

  // PERBAIKAN 2026-08-10 (temuan user, screenshot: 2 menu ke-highlight bersamaan) — kalau href
  // menu A jadi prefix dari href menu B (mis. "Ekstrakurikuler" vs "Absen Ekstra" waktu masih
  // bersarang di "/ekstrakurikuler/absensi"), dulu KEDUANYA dianggap aktif. Sekarang hanya href
  // PALING SPESIFIK (terpanjang) yg match dianggap aktif.
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

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 bg-primary-900 h-screen sticky top-0 shrink-0 relative overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent
          logoEmblem={logoEmblem} logoFullWhite={logoFullWhite}
          search={search} setSearch={setSearch}
          filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
          isActive={isActive} onLinkClick={() => setOpen(false)}
        />
      </aside>
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-50 bg-primary-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          {logoFullWhite ? (
            <Image src={logoFullWhite} alt="SMK Al Munawwir IIBS" width={140} height={40} className="h-7 w-auto object-contain" unoptimized />
          ) : (
            <>
              <Image src={logoEmblem} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
              <span className="font-heading font-bold text-white text-sm">Portal Guru</span>
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
              search={search} setSearch={setSearch}
              filteredGroups={filteredGroups} openGroups={openGroups} toggleGroup={toggleGroup}
              isActive={isActive} onLinkClick={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
