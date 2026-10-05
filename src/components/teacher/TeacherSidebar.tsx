"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, Users, LogOut, Globe, UserCircle, Calendar, NotebookPen, Briefcase, BookOpen, Gauge, GraduationCap, Award, HeartHandshake, Building2, ListChecks, ShieldCheck, ShieldAlert, BadgeCheck, UserCheck, Megaphone, Database, Wrench, Boxes, FlaskConical, HeartPulse, Flag, Library, Network, FileQuestion, BookMarked, Users2, CalendarClock, UserCog, Repeat, Mail, Archive, Trophy, FileCheck2, Search, BookOpenCheck, ChevronDown, MoreHorizontal, Wallet, DatabaseZap, CalendarX2, Vote, IdCard, LayoutGrid, DoorOpen, Moon, Medal
} from "lucide-react";
import { JABATAN_EVENT } from "@/lib/event-label";
import { Siren } from "lucide-react";
import { QrCode, ScanLine, MessageSquareHeart, MessagesSquare, Contact, Hammer, ClipboardPen, CalendarCheck, BriefcaseBusiness, Activity, UserPlus, Camera, CircleHelp, ClipboardCheck, CalendarRange } from "lucide-react";
import { FileUser } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { logout } from "@/app/actions/auth";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import MenuAkunMobile from "@/components/shared/MenuAkunMobile";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";

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
            <p className="text-white/40 text-xs font-semibold tracking-wider uppercase">Portal Guru</p>
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
        {filteredGroups.map(group => {
          const isRoot = group.label === null;
          const isOpen = isRoot || !!search.trim() || openGroups.has(group.label!);
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
                    const badgeCount = item.badge ?? 0;
                    return (
                      <Link key={item.href} href={item.href} onClick={onLinkClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gold text-primary-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                        <item.icon size={17} />
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className={`text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${active ? "bg-primary-900/20 text-primary-900" : "bg-red-500 text-white"}`}>
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
  /** Punya Penugasan Mengajar. Tanpa penugasan (mis. Kepala Sekolah), menu Mengajar disembunyikan (permintaan user 17 Sep 2026). */
  hasTeaching?: boolean;
  /** Antrean "Perlu tindakan" (src/lib/antrean-kerja.ts) untuk lonceng di bar atas HP. */
  tindakan?: { label: string; count: number; href: string }[];
  logoEmblem?: string;
  logoFullWhite?: string;
  jabatanNames?: string[];
  hasInternshipBimbingan?: boolean;
  isGuruPiketOnDutyToday?: boolean;
  overdueBooks?: number;
  hasHomeroom?: boolean;
  /** Admin sedang "Masuk Sebagai" akun ini — topbar mobile (fixed top-0) digeser turun sedikit
   * supaya tidak ketutup pita ImpersonationBanner (sticky top-0, z-index lebih tinggi) yang
   * nempel di posisi sama. Tanpa ini tombol hamburger (buka drawer sidebar) jadi tidak kelihatan
   * sama sekali di mobile saat impersonasi (temuan user 2026-08-13). */
  impersonating?: boolean;
}

/** SATU SUMBER menu Portal Guru — dipakai sidebar desktop, bottom nav HP, dan kisi "Semua Menu"
 * di dashboard (MenuLengkap). Jangan mendaftar ulang menu di tempat lain. */
export function grupMenuGuru({
  jabatanNames = [], hasInternshipBimbingan = false, isGuruPiketOnDutyToday = false,
  overdueBooks = 0, hasHomeroom = false, hasTeaching = true,
}: TeacherSidebarProps = {}): MenuGroup[] {
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
  const isBendahara = jabatanNames.includes("Bendahara Sekolah") || jabatanNames.includes("Bendahara BOS") || jabatanNames.includes("Bendahara BPOPP");
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

  return [

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
        ...(isKepalaLab ? [{ href: "/dashboard/teacher/lab", label: "Dashboard Laboratorium", icon: FlaskConical }] : []),
        ...(isWakasekHumas ? [{ href: "/dashboard/teacher/humas", label: "Dashboard Humas", icon: Building2 }] : []),
        ...(isWakasekPenjaminMutu ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu", label: "Dashboard Penjamin Mutu", icon: BadgeCheck }] : []),
        ...(isKaprogli ? [{ href: "/dashboard/teacher/wakasek/kaprogli", label: "Dashboard Kaprogli", icon: Award }] : []),
        ...(isGuruBk ? [{ href: "/dashboard/teacher/bk", label: "Dashboard BK", icon: HeartHandshake }] : []),
        ...(isKoordinatorBkk ? [{ href: "/dashboard/teacher/bkk", label: "Dashboard BKK", icon: UserCheck }] : []),
        ...(isKoordinatorBranding ? [{ href: "/dashboard/teacher/branding", label: "Dashboard Branding & Publikasi", icon: Megaphone }] : []),
        ...(isOperatorSekolah ? [
          { href: "/dashboard/teacher/operator", label: "Dashboard Operator Sekolah", icon: Database },
          { href: "/dashboard/teacher/dapodik", label: "Sinkron Dapodik", icon: DatabaseZap },
        ] : []),
        // Panitia SPMB = JABATAN_SPMB di src/lib/spmb.ts. Daftarnya disebut di DUA tempat (penjaga
        // server + menu ini); kalau menambah jabatan panitia, ubah keduanya.
        ...(isOperatorSekolah || isWakasekKesiswaan || isWakasekHumas || isKepalaSekolah || isKoordinatorBranding
          ? [{ href: "/pusat-spmb", label: "Pusat SPMB", icon: ClipboardList }] : []),
        ...(isKepalaUks ? [{ href: "/dashboard/teacher/uks", label: "Dashboard UKS", icon: HeartPulse }] : []),
        ...(isBendahara ? [{ href: "/dashboard/bendahara", label: "Bendahara", icon: Wallet }] : []),
      ],
    },
    // Grup disusun menurut ALUR KERJA guru (keputusan user 15 Sep 2026): mengajar → kelas wali → kesiswaan →
    // kinerja → PKL → sarana → tata usaha. Menu hanya tampil bagi yang memerlukannya (17 Sep 2026: "jika tidak mengajar
    // tidak perlu fitur jurnal, materi, tugas"; "jika tidak wali kelas tidak perlu fitur wali kelas & daftar siswa").
    {
      label: "Mengajar",
      items: [
        ...(hasTeaching ? [
          { href: "/dashboard/teacher/schedule", label: "Jadwal Saya", icon: Calendar },
          { href: "/dashboard/teacher/journal", label: "Jurnal Mengajar", icon: NotebookPen },
          { href: "/dashboard/teacher/materials", label: "Materi & Tugas", icon: BookOpen },
          { href: "/dashboard/teacher/rpp", label: "Bank RPP", icon: NotebookPen },
          { href: "/dashboard/teacher/kelengkapan-perangkat", label: "Kelengkapan Perangkat Ajar", icon: ClipboardCheck },
          { href: "/dashboard/teacher/rencana-ajar", label: "Prota, Promes & Pekan Efektif", icon: CalendarRange },
        ] : []),
        ...(hasTeaching || isWakasekKurikulum ? [{ href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion }] : []),
        // Form Nilai Rapor (22 Sep 2026): lembar penilaian guru mapel → rapor wali kelas (src/components/rapor).
        ...(hasTeaching || isWakasekKurikulum ? [{ href: "/dashboard/teacher/form-nilai-rapor", label: "Form Nilai Rapor", icon: ClipboardPen }] : []),
        ...(isWakasekKurikulum ? [
          { href: "/dashboard/teacher/wakasek/kurikulum/jadwal", label: "Jadwal Pelajaran", icon: Calendar },
          { href: "/dashboard/teacher/wakasek/kurikulum/mapel", label: "Kode Mata Pelajaran", icon: BookMarked },
          { href: "/dashboard/teacher/wakasek/kurikulum/penugasan", label: "Penugasan Mengajar", icon: Users2 },
        ] : []),
      ],
    },
    {
      label: "Wali Kelas & Siswa",
      items: [
        ...(hasHomeroom || kesiswaanBkAccess || isKepalaSekolah ? [{ href: "/dashboard/teacher/students", label: "Daftar Siswa", icon: Users }] : []),
        ...(hasHomeroom ? [{ href: "/dashboard/teacher/attendance", label: "Absensi", icon: CheckSquare }] : []),
        // Read-only. Kesiswaan/BK lintas kelas (bukan cuma kelas wali) — butuh pantau kehadiran
        // siswa sekolah utk keperluan pembinaan/konseling. Wali kelas biasa (bukan Kesiswaan/BK)
        // tetap dapat menu ini tapi dibatasi ke kelas walinya sendiri (lihat AbsensiSiswaManager
        // classesEndpoint). Input absensi resmi tetap khusus wali kelas lewat menu Absensi di atas.
        ...(kesiswaanBkAccess
          ? [{ href: "/dashboard/teacher/kesiswaan/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare }]
          : hasHomeroom
          ? [{ href: "/dashboard/teacher/absensi-siswa", label: "Rekap Absensi Siswa", icon: CheckSquare }]
          : []),
        // Absensi siswa lewat pindai: petugas piket hari ini (gerbang) & wali kelas (kelasnya) — akses dicek di API.
        ...(isGuruPiketOnDutyToday || hasHomeroom ? [{ href: "/dashboard/teacher/absensi-qr", label: "Layar QR Absen Mandiri", icon: QrCode }] : []),
        ...(hasHomeroom ? [{ href: "/dashboard/teacher/dkn", label: "DKN Kelas", icon: ClipboardList }] : []),
        ...(hasHomeroom ? [{ href: "/dashboard/teacher/rapor-kelas", label: "Nilai & Rapor Kelas", icon: FileCheck2 }] : []),
        ...(hasHomeroom ? [
          { href: "/dashboard/teacher/piket-kelas", label: "Jadwal Piket Kelas", icon: CalendarClock },
          { href: "/dashboard/teacher/kunjungan-rumah", label: "Kunjungan Rumah", icon: HeartHandshake },
        ] : []),
        // Rujukan ke BK dari wali kelas — Guru BK/Wakasek Kesiswaan memakai menu "Janji Konseling" (halaman sama).
        ...(hasHomeroom && !kesiswaanBkAccess ? [{ href: "/dashboard/teacher/konseling", label: "Rujukan Konseling", icon: MessagesSquare }] : []),
        ...(hasHomeroom || kesiswaanBkAccess ? [{ href: "/dashboard/teacher/kontak-ortu", label: "Kontak Orang Tua", icon: Contact }] : []),
        // Data kesehatan UKS: wali kelas (kelasnya) & Guru BK (semua) — keputusan user 17 Sep 2026.
        ...((hasHomeroom || isGuruBk) && !isKepalaUks ? [{ href: "/dashboard/teacher/kesehatan-siswa", label: "Kesehatan Siswa (UKS)", icon: HeartPulse }] : []),
        ...(hasHomeroom || kesiswaanBkAccess ? [{ href: "/dashboard/teacher/izin-siswa", label: "Izin / Sakit Siswa", icon: CalendarX2 }] : []),
        // Wali kelas: di-scope otomatis ke kelas walinya saja. Operator Sekolah: semua kelas
        // (disamakan TAS) — lihat src/lib/buku-induk-access.ts. Keputusan eksplisit user 2026-08-22.
        ...(hasHomeroom || isOperatorSekolah ? [{ href: "/dashboard/teacher/buku-induk-siswa", label: "Buku Induk Siswa", icon: BookOpen }] : []),
        ...(isOperatorSekolah && !isTasStaff ? [{ href: "/dashboard/teacher/buku-induk-guru", label: "Buku Induk Guru", icon: UserCog }] : []),
        // Peringatan Dini Siswa: wali kelas (kelasnya) & Wakasek Kesiswaan (semua). Guru BK memakai Dashboard BK (isi sama).
        ...((hasHomeroom || isWakasekKesiswaan || isKepalaSekolah) && !isGuruBk ? [{ href: "/dashboard/teacher/peringatan-dini", label: "Peringatan Dini Siswa", icon: Siren }] : []),
      ],
    },
    {
      label: "Kesiswaan & BK",
      items: [
        // Poin Siswa (Tata Tertib) — akses PENUH khusus Wakasek Kesiswaan & Guru BK. Guru Piket
        // (siapa pun terjadwal piket HARI INI, bukan jabatan tetap) dapat menu terbatas terpisah,
        // cuma boleh catat Terlambat & seragam/atribut (lihat kesiswaan-guard.ts).
        ...(kesiswaanBkAccess || isKepalaSekolah ? [{ href: "/dashboard/teacher/kesiswaan/papan", label: "Papan Kesiswaan", icon: Activity }] : []),
        ...(kesiswaanBkAccess || isKepalaSekolah ? [{ href: "/dashboard/teacher/imam-sholat", label: "Jadwal Imam Sholat", icon: Moon }] : []),
        ...(kesiswaanBkAccess ? [
          { href: "/dashboard/teacher/kesiswaan/poin-siswa", label: "Poin Siswa", icon: ShieldAlert },
          { href: "/dashboard/teacher/kesiswaan/rekam-bk", label: "Rekam BK — Penanganan Siswa", icon: HeartHandshake },
          { href: "/dashboard/teacher/kesiswaan/panggilan", label: "Panggilan Orang Tua", icon: Mail },
          { href: "/dashboard/teacher/konseling", label: "Janji Konseling", icon: MessagesSquare },
          { href: "/dashboard/teacher/aspirasi", label: "Kotak Aspirasi Siswa", icon: MessageSquareHeart },
        ] : []),
        ...(isGuruPiketOnDutyToday || kesiswaanBkAccess ? [{ href: "/dashboard/teacher/piket", label: "Piket Harian", icon: Siren }] : []),
        ...(isGuruPiketOnDutyToday && !kesiswaanBkAccess ? [{ href: "/dashboard/teacher/piket/poin-siswa", label: "Catat Poin Siswa (Piket)", icon: ShieldAlert }] : []),
        ...(isGuruPiketOnDutyToday ? [{ href: "/dashboard/teacher/absensi-scan", label: "Scan Kartu Absensi", icon: ScanLine }] : []),
        ...(isPembinaOsis || isWakasekKesiswaan ? [{ href: "/dashboard/teacher/pemilihan-osis", label: "Pemilihan OSIS", icon: Vote }] : []),
        // Pengelola Lomba & Event — daftar jabatan SATU sumber dengan penjaga server (src/lib/event-label.ts).
        ...(JABATAN_EVENT.some(n => jabatanNames.includes(n)) ? [{ href: "/dashboard/teacher/event", label: "Lomba & Event", icon: Medal }] : []),
        ...(ekstrakurikulerAccess ? [
          { href: "/dashboard/teacher/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag },
          { href: "/dashboard/teacher/absen-ekstra", label: "Absen Ekstra", icon: CheckSquare },
          { href: "/dashboard/teacher/ekstrakurikuler/nilai", label: "Nilai Ekstrakurikuler", icon: Award },
          { href: "/dashboard/teacher/ekstrakurikuler/agenda", label: "Jadwal Latihan & Lomba", icon: CalendarClock },
        ] : []),
        { href: "/dashboard/teacher/tata-tertib", label: "Tata Tertib Peserta Didik", icon: BookOpenCheck },
      ],
    },
    {
      label: "Kinerja & Piket",
      items: [
        { href: "/dashboard/teacher/tugas", label: "Papan Tugas", icon: ClipboardList },
        { href: "/dashboard/teacher/pkb", label: "Portofolio PKB", icon: Award },
        { href: "/dashboard/teacher/kinerja", label: "Kinerja Saya", icon: Award },
        { href: "/dashboard/teacher/masukan-rekan", label: "Masukan Rekan", icon: MessageSquareHeart },
        { href: "/dashboard/teacher/supervisi", label: "Supervisi & PKG", icon: ClipboardCheck },
        { href: "/dashboard/teacher/kegiatan", label: "Presensi Kegiatan", icon: CalendarCheck },
        { href: "/dashboard/teacher/kegiatan-tidak-ikut", label: "Tidak Ikut Kegiatan", icon: CalendarX2 },
        { href: "/dashboard/teacher/pengawas-ujian", label: "Jadwal Pengawas Ujian", icon: UserCheck },
        { href: "/dashboard/teacher/arsip-sk", label: "Arsip SK & Dokumen Saya", icon: Archive },
        { href: "/dashboard/teacher/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy },
        ...((isWakasekPenjaminMutu || isWakasekKurikulum || isGuruPiketOnDutyToday) ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan", label: "Kedisiplinan Guru", icon: BadgeCheck }] : []),
        ...((isWakasekPenjaminMutu || isWakasekKurikulum) ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu/kehadiran-guru", label: "Kehadiran Guru Terpadu", icon: UserCheck }] : []),
        ...((isWakasekPenjaminMutu || isGuruPiket) ? [{ href: "/dashboard/teacher/wakasek/penjamin-mutu/jadwal-piket", label: "Jadwal Piket", icon: CalendarClock }] : []),
        ...(jabatanNames.length > 0 ? [{ href: "/dashboard/teacher/program-kerja", label: "Program Kerja", icon: ListChecks }] : []),
      ],
    },
    {
      label: "PKL & Alumni",
      items: [
        ...(hasInternshipBimbingan ? [{ href: "/dashboard/teacher/pkl", label: "PKL Pembimbingan", icon: Briefcase }] : []),
        ...(isWakasekHumas ? [
          { href: "/dashboard/teacher/humas/pkl-pendaftaran", label: "Pendaftaran PKL", icon: FileCheck2 },
          { href: "/dashboard/teacher/humas/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2 },
          { href: "/dashboard/teacher/humas/tracer-study", label: "Tracer Study Alumni", icon: UserCheck },
        ] : []),
        ...(isKepalaSekolah ? [{ href: "/dashboard/teacher/kepala-sekolah/mitra", label: "Peta Kemitraan Industri", icon: Building2 }] : []),
        ...(isKoordinatorBkk || isWakasekHumas ? [{ href: "/dashboard/teacher/bkk/lowongan", label: "Lowongan Kerja BKK", icon: BriefcaseBusiness }] : []),
      ],
    },
    {
      label: "Sarana & Perpustakaan",
      items: [
        ...(isWakasekSarpras ? [{ href: "/dashboard/teacher/wakasek/sarpras/inventaris", label: "Inventaris Barang", icon: Boxes }] : []),
        ...(isKepalaLab ? [{ href: "/dashboard/teacher/lab/inventaris", label: "Inventaris Lab", icon: Boxes }] : []),
        ...(isWakasekSarpras ? [{ href: "/dashboard/teacher/wakasek/sarpras/peminjaman", label: "Peminjaman & Ruang", icon: CalendarClock }]
          : isKepalaLab ? [{ href: "/dashboard/teacher/lab/peminjaman", label: "Peminjaman Lab", icon: CalendarClock }] : []),
        // Semua guru: lapor kerusakan berfoto & pinjam barang / pesan ruang (17 Sep 2026).
        // Jaringan & Layar menyatukan Layar/TV, Perangkat, CCTV, Router, dan Mode Ujian (CLAUDE.md #85) —
        // syaratnya gabungan semua yang berhak SALAH SATU tabnya; tab yang tidak berhak tidak dirender.
        ...(isWakasekSarpras || isKepalaLab || isPengelolaJaringan || isKepalaSekolah || isWakasekKesiswaan
          ? [{ href: "/dashboard/teacher/jaringan", label: "Jaringan & Layar", icon: Network }] : []),
        ...(isWakasekSarpras || isKepalaLab ? [{ href: "/dashboard/teacher/daftar-ruang", label: "Daftar Ruang", icon: DoorOpen }] : []),
        { href: "/dashboard/teacher/layanan-sarpras", label: "Layanan Sarpras", icon: Hammer },
        // Usulan pengadaan alat/bahan praktik: pengusul lihat miliknya, pengelola Sarpras/Lab melihat semua.
        { href: isWakasekSarpras ? "/dashboard/teacher/wakasek/sarpras/usulan-alat" : isKepalaLab ? "/dashboard/teacher/lab/usulan-alat" : "/dashboard/teacher/usulan-alat", label: "Usulan Alat & Bahan", icon: Boxes },
        { href: "/perpustakaan", label: "Perpustakaan Digital", icon: BookOpen },
        ...(isPerpustakaan ? [{ href: "/pusat-perpustakaan", label: "Pusat Perpustakaan", icon: Library }] : []),
        { href: "/dashboard/teacher/buku-saya", label: "Buku Saya", icon: BookOpen, badge: overdueBooks },
        { href: "/dashboard/teacher/perpustakaan-peringkat", label: "Papan Peringkat Perpustakaan", icon: Trophy },
      ],
    },
    ...(isTasStaff ? [{
      label: "Tata Usaha",
      items: [
        { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen },
        { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog },
        { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat },
        { href: "/dashboard/admin/verifikasi-data", label: "Verifikasi Perubahan Data", icon: ShieldCheck },
        { href: "/dashboard/admin/persuratan", label: "Persuratan", icon: Mail },
        { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen },
        { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive },
      ],
    }] : []),
    {
      label: "Akun Saya",
      items: [
        { href: "/dashboard/teacher/pengumuman", label: "Pengumuman", icon: Megaphone },
        { href: "/dashboard/teacher/survei", label: "Survei & Angket", icon: ClipboardPen },
        // Semua guru boleh mengirim cerita & foto kegiatan ke Tim Branding (17 Sep 2026).
        { href: "/dashboard/teacher/liputan", label: "Kirim Liputan Kegiatan", icon: Camera },
        { href: "/dashboard/teacher/absen-mandiri", label: "Presensi Mandiri", icon: QrCode },
        { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
        { href: "/dashboard/teacher/biodata", label: "Biodata Saya", icon: FileUser },
        { href: "/dashboard/teacher/profile", label: "Profil Saya", icon: UserCircle },
        { href: "/bantuan", label: "Pusat Bantuan", icon: CircleHelp },
      ],
    },
  ];
}

export default function TeacherSidebar(props: TeacherSidebarProps) {
  const {
    logoEmblem = "/images/logo-emblem.png", logoFullWhite, jabatanNames = [], hasInternshipBimbingan = false,
    isGuruPiketOnDutyToday = false, overdueBooks = 0, hasHomeroom = false, impersonating = false, tindakan = [], hasTeaching = true,
  } = props;
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const isTasStaff = jabatanNames.includes("Tenaga Administrasi Sekolah") || jabatanNames.includes("Kepala Tenaga Administrasi Sekolah");
  const menuGroups = grupMenuGuru({ jabatanNames, hasInternshipBimbingan, isGuruPiketOnDutyToday, overdueBooks, hasHomeroom, hasTeaching });
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

  // Bottom nav HP (18 Sep 2026): 4 tautan harian + tombol tengah Dashboard, TANPA sheet — seluruh
  // menu ada di kisi "Semua Menu" dashboard & /dashboard/teacher/menu.
  const navBawah: ItemNavBawah[] = [
    { href: "/dashboard/teacher/journal", label: "Jurnal", icon: NotebookPen, simbol: "edit_note" },
    ...(hasHomeroom
      ? [{ href: "/dashboard/teacher/attendance", label: "Absensi", icon: ClipboardCheck, simbol: "fact_check" }]
      : [{ href: "/dashboard/teacher/schedule", label: "Jadwal", icon: Calendar, simbol: "calendar_month" }]),
    { href: "/dashboard/teacher/students", label: "Siswa", icon: Users, simbol: "groups" },
    { href: "/dashboard/teacher/pengumuman", label: "Info", icon: Megaphone, simbol: "campaign" },
  ];

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
          isActive={isActive} onLinkClick={() => {}}
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
              <span className="font-heading font-bold text-white text-sm">Portal Guru</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <KotakNotifikasiTombol variant="topbar" tindakan={tindakan} />
          <MenuAkunMobile profilHref="/dashboard/teacher/profile" />
        </div>
      </div>

      <MobileBottomNav items={navBawah} beranda={{ href: "/dashboard/teacher", icon: LayoutDashboard, simbol: "home", label: "Beranda" }} />
    </>
  );
}
