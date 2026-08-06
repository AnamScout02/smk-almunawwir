"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, Users, LogOut, Menu, X, Globe, UserCircle, Calendar, NotebookPen, Briefcase, BookOpen, Gauge, GraduationCap, Award, HeartHandshake, Building2, ListChecks, ShieldCheck, BadgeCheck, UserCheck, Megaphone, Database, Wrench, Boxes, FlaskConical, HeartPulse, Flag, Library, Network, FileQuestion, BookMarked, Users2, CalendarClock, UserCog, Repeat, Mail, Archive, Trophy, FileCheck2 } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions/auth";

interface TeacherSidebarProps {
  logoEmblem?: string;
  logoFullWhite?: string;
  jabatanNames?: string[];
  hasInternshipBimbingan?: boolean;
  isGuruPiketOnDutyToday?: boolean;
}

export default function TeacherSidebar({
  logoEmblem = "/images/logo-emblem.png", logoFullWhite, jabatanNames = [], hasInternshipBimbingan = false,
  isGuruPiketOnDutyToday = false,
}: TeacherSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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

  const menu = [
    { href: "/dashboard/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true, show: true },
    { href: "/dashboard/teacher/kepala-sekolah", label: "Dashboard Kepala Sekolah", icon: Gauge, show: isKepalaSekolah },
    { href: "/dashboard/teacher/wakasek/kurikulum", label: "Dashboard Kurikulum", icon: GraduationCap, show: isWakasekKurikulum },
    { href: "/dashboard/teacher/wakasek/kurikulum/jadwal", label: "Jadwal Pelajaran", icon: Calendar, show: isWakasekKurikulum },
    { href: "/dashboard/teacher/wakasek/kurikulum/mapel", label: "Kode Mata Pelajaran", icon: BookMarked, show: isWakasekKurikulum },
    { href: "/dashboard/teacher/wakasek/kurikulum/penugasan", label: "Penugasan Mengajar", icon: Users2, show: isWakasekKurikulum },
    { href: "/dashboard/teacher/wakasek/kesiswaan", label: "Dashboard Kesiswaan", icon: ShieldCheck, show: isWakasekKesiswaan },
    { href: "/dashboard/teacher/wakasek/sarpras", label: "Dashboard Sarpras", icon: Wrench, show: isWakasekSarpras },
    { href: "/dashboard/teacher/wakasek/sarpras/inventaris", label: "Inventaris Barang", icon: Boxes, show: isWakasekSarpras },
    { href: "/dashboard/teacher/wakasek/penjamin-mutu", label: "Dashboard Penjamin Mutu", icon: BadgeCheck, show: isWakasekPenjaminMutu },
    { href: "/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan", label: "Kedisiplinan Guru", icon: BadgeCheck, show: isWakasekPenjaminMutu || isWakasekKurikulum || isGuruPiketOnDutyToday },
    { href: "/dashboard/teacher/kedisiplinan-leaderboard", label: "Kedisiplinan & Kinerja", icon: Trophy, show: true },
    { href: "/dashboard/teacher/kinerja", label: "Kinerja Saya", icon: Award, show: true },
    { href: "/dashboard/teacher/wakasek/penjamin-mutu/jadwal-piket", label: "Jadwal Piket", icon: CalendarClock, show: isWakasekPenjaminMutu || isGuruPiket },
    { href: "/dashboard/teacher/wakasek/kaprogli", label: "Dashboard Kaprogli", icon: Award, show: isKaprogli },
    { href: "/dashboard/teacher/bk", label: "Dashboard BK", icon: HeartHandshake, show: isGuruBk },
    { href: "/dashboard/teacher/bkk", label: "Dashboard BKK", icon: UserCheck, show: isKoordinatorBkk },
    { href: "/dashboard/teacher/branding", label: "Dashboard Branding & Publikasi", icon: Megaphone, show: isKoordinatorBranding },
    { href: "/dashboard/teacher/operator", label: "Dashboard Operator Sekolah", icon: Database, show: isOperatorSekolah },
    { href: "/dashboard/teacher/lab/inventaris", label: "Inventaris Lab", icon: FlaskConical, show: isKepalaLab },
    { href: "/dashboard/teacher/uks", label: "Dashboard UKS", icon: HeartPulse, show: isKepalaUks },
    { href: "/dashboard/teacher/ekstrakurikuler", label: "Ekstrakurikuler", icon: Flag, show: isPembinaOsis || isPembinaPramuka || isKoordinatorEkstrakurikuler },
    { href: "/dashboard/teacher/perpustakaan", label: "Perpustakaan", icon: Library, show: isPerpustakaan },
    { href: "/dashboard/teacher/jaringan", label: "Jaringan Sekolah", icon: Network, show: isPengelolaJaringan },
    { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk Siswa", icon: BookOpen, show: isTasStaff },
    { href: "/dashboard/admin/buku-induk/guru", label: "Buku Induk Guru", icon: UserCog, show: isTasStaff },
    { href: "/dashboard/admin/buku-mutasi", label: "Buku Mutasi", icon: Repeat, show: isTasStaff },
    { href: "/dashboard/admin/persuratan", label: "Persuratan", icon: Mail, show: isTasStaff },
    { href: "/dashboard/admin/arsip", label: "Pengarsipan", icon: Archive, show: isTasStaff },
    { href: "/dashboard/admin/notulen-rapat", label: "Notulen Rapat", icon: NotebookPen, show: isTasStaff },
    { href: "/dashboard/admin/verifikasi-data", label: "Verifikasi Perubahan Data", icon: ShieldCheck, show: isTasStaff },
    { href: "/dashboard/teacher/humas/pkl-pendaftaran", label: "Pendaftaran PKL", icon: FileCheck2, show: isWakasekHumas },
    { href: "/dashboard/teacher/humas/industry-partners", label: "Mitra Industri (DU/DI)", icon: Building2, show: isWakasekHumas },
    { href: "/dashboard/teacher/humas/tracer-study", label: "Tracer Study Alumni", icon: UserCheck, show: isWakasekHumas },
    { href: "/dashboard/teacher/kepala-sekolah/mitra", label: "Peta Kemitraan Industri", icon: Building2, show: isKepalaSekolah },
    { href: "/dashboard/teacher/program-kerja", label: "Program Kerja", icon: ListChecks, show: jabatanNames.length > 0 },
    { href: "/dashboard/teacher/schedule", label: "Jadwal Saya", icon: Calendar, show: true },
    { href: "/dashboard/teacher/students", label: "Daftar Siswa", icon: Users, show: true },
    { href: "/dashboard/teacher/grades", label: "Input Nilai", icon: ClipboardList, show: true },
    { href: "/dashboard/teacher/rpp", label: "Bank RPP", icon: NotebookPen, show: true },
    { href: "/pusat-ujian", label: "Ujian Online (CBT)", icon: FileQuestion, show: true },
    { href: "/dashboard/teacher/attendance", label: "Absensi", icon: CheckSquare, show: true },
    { href: "/dashboard/teacher/journal", label: "Jurnal Mengajar", icon: NotebookPen, show: true },
    { href: "/dashboard/teacher/pkl", label: "PKL Pembimbingan", icon: Briefcase, show: hasInternshipBimbingan },
    { href: "/dashboard/teacher/materials", label: "Materi & Tugas", icon: BookOpen, show: true },
    { href: "/dashboard/teacher/profile", label: "Profil Saya", icon: UserCircle, show: true },
  ].filter(item => item.show);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const SidebarContent = () => (
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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scroll">
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
      <aside className="hidden lg:flex flex-col w-56 bg-primary-900 min-h-screen shrink-0 fixed top-0 left-0 bottom-0 overflow-hidden print:hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <SidebarContent />
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
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
