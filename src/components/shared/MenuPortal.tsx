"use client";
import MenuLengkap, { type GrupMenuKisi, type ItemMenuKisi } from "@/components/shared/MenuLengkap";
import { grupMenuSiswa } from "@/components/student/StudentSidebar";
import { grupMenuGuru } from "@/components/teacher/TeacherSidebar";
import { grupMenuOrtu } from "@/components/parent/ParentSidebar";
import { menuGroups as GRUP_ADMIN } from "@/components/admin/AdminSidebar";
import { menuGroupsTas as GRUP_TAS } from "@/components/admin/TasSidebar";
import { isFullTasJabatan } from "@/lib/tas-jabatan";
import {
  QrCode, NotebookPen, Users, Megaphone, GraduationCap, Archive, CalendarDays, LayoutDashboard,
  ClipboardList, BarChart2, UserCheck, Calendar, FileQuestion, IdCard, ShieldAlert, HeartPulse,
  MessagesSquare, FileText, School, BookUser, ClipboardCheck } from "lucide-react";

type Grup = { label: string | null; items: { href: string; label: string; icon: ItemMenuKisi["icon"]; exact?: boolean; badge?: number }[] };

/** Buang item "Dashboard" (sudah jadi tombol tengah bottom nav) & grup kosong. */
function rapikan(grup: Grup[]): GrupMenuKisi[] {
  return grup
    .map(g => ({ label: g.label, items: g.items.filter(i => !/\/dashboard\/(admin|teacher|student|parent|bendahara)$/.test(i.href)) }))
    .filter(g => g.items.length > 0);
}

export interface PropsMenuPortal { ringkas?: number; hrefSemua?: string; judul?: string; favoritAwal?: string[] | null }

/** KISI MENU per portal — membungkus `MenuLengkap` dengan sumber menu portal yang bersangkutan.
 * Halaman SERVER cukup mengirim data polos (bukan elemen ikon — CLAUDE.md #35). */
export function MenuSiswa({ isKelasAdmin, overdueBooks, kelasXII, hasPendingBiodata, ...p }: PropsMenuPortal & {
  isKelasAdmin?: boolean; overdueBooks?: number; kelasXII?: boolean; hasPendingBiodata?: boolean;
}) {
  const grup = rapikan(grupMenuSiswa({ isKelasAdmin, overdueBooks, kelasXII, hasPendingBiodata }) as Grup[]);
  // Pita pintasan SENGAJA berbeda dari empat tautan bottom navbar (Tugas/Absen/Rapor/Buku) — kalau isinya
  // sama persis, pita itu cuma mengulang bar bawah (temuan saat memeriksa tampilan 18 Sep 2026).
  const pintasan: ItemMenuKisi[] = [
    { href: "/ujian-online", label: "Ujian Online", icon: FileQuestion },
    { href: "/dashboard/student/pengumuman", label: "Pengumuman", icon: Megaphone },
    { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
    { href: "/dashboard/student/poin-saya", label: "Poin Saya", icon: ShieldAlert },
  ];
  return <MenuLengkap grup={grup} pintasan={pintasan} {...p} />;
}

export function MenuGuru({ jabatanNames, hasHomeroom, hasTeaching, hasInternshipBimbingan, isGuruPiketOnDutyToday, overdueBooks, panitiaSpmb, ...p }: PropsMenuPortal & {
  jabatanNames?: string[]; hasHomeroom?: boolean; hasTeaching?: boolean; hasInternshipBimbingan?: boolean;
  isGuruPiketOnDutyToday?: boolean; overdueBooks?: number; panitiaSpmb?: boolean;
}) {
  const grup = rapikan(grupMenuGuru({ jabatanNames, hasHomeroom, hasTeaching, hasInternshipBimbingan, isGuruPiketOnDutyToday, overdueBooks, panitiaSpmb }) as Grup[]);
  // Pintasan guru (pilihan user 18 Sep 2026): Guru Piket hanya saat memang terjadwal piket hari ini —
  // di hari lain slot itu diisi Jadwal Mengajar supaya tidak ada pintasan yang mentok.
  const pintasan: ItemMenuKisi[] = [
    isGuruPiketOnDutyToday
      ? { href: "/dashboard/teacher/piket", label: "Guru Piket", icon: ClipboardCheck }
      : { href: "/dashboard/teacher/schedule", label: "Jadwal Mengajar", icon: Calendar },
    { href: "/dashboard/teacher/journal", label: "Jurnal Mengajar", icon: NotebookPen },
    { href: "/dashboard/teacher/absen-mandiri", label: "Presensi Mandiri", icon: QrCode },
    { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
  ];
  return <MenuLengkap grup={grup} pintasan={pintasan} {...p} />;
}

export function MenuOrtu(p: PropsMenuPortal) {
  const grup = rapikan(grupMenuOrtu() as Grup[]);
  const pintasan: ItemMenuKisi[] = [
    { href: "/dashboard/parent/poin", label: "Poin Anak", icon: ShieldAlert },
    { href: "/dashboard/parent/kesehatan", label: "Kesehatan", icon: HeartPulse },
    { href: "/dashboard/parent/konseling", label: "Janji Temu", icon: MessagesSquare },
    { href: "/dashboard/parent/permintaan-surat", label: "Permintaan Surat", icon: FileText },
  ];
  return <MenuLengkap grup={grup} pintasan={pintasan} {...p} />;
}

export function MenuAdmin(p: PropsMenuPortal) {
  const grup = rapikan(GRUP_ADMIN as unknown as Grup[]);
  const pintasan: ItemMenuKisi[] = [
    { href: "/dashboard/admin/buku-induk/siswa", label: "Buku Induk", icon: BookUser },
    { href: "/dashboard/admin/classes", label: "Kelas", icon: School },
    { href: "/dashboard/admin/teachers", label: "Guru & Pegawai", icon: Users },
    { href: "/dashboard/admin/presensi-pegawai", label: "Presensi Pegawai", icon: UserCheck },
  ];
  return <MenuLengkap grup={grup} pintasan={pintasan} {...p} />;
}

export function MenuTas({ jabatanNames = [], ...p }: PropsMenuPortal & { jabatanNames?: string[] }) {
  const penuh = isFullTasJabatan(jabatanNames);
  const grup = rapikan(
    (GRUP_TAS as unknown as { label: string | null; items: (Grup["items"][number] & { show: (j: string[], f: boolean) => boolean })[] }[])
      .map(g => ({ label: g.label, items: g.items.filter(i => i.show(jabatanNames, penuh)) })) as Grup[],
  );
  /* Pintasan Tata Usaha hanya untuk staf TU penuh — keempat tautannya dijaga `verifyTasAccess()`,
     jadi bagi staf TAS non-TU (Kepala UKS, Tim Perpustakaan, Security) tiga di antaranya memantul
     ke /login lalu kembali ke dashboard, terbaca sebagai "dipencet tidak terjadi apa-apa"
     (laporan user 28 September 2026). Mereka mendapat pintasan dari menunya sendiri. */
  const pintasanTu: ItemMenuKisi[] = [
    { href: "/dashboard/admin/arsip", label: "E-Arsip", icon: Archive },
    { href: "/dashboard/admin/layanan-surat", label: "Layanan Surat", icon: ClipboardList },
    { href: "/dashboard/admin/students", label: "Data Siswa", icon: GraduationCap },
    { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
  ];
  const pintasanJabatan: ItemMenuKisi[] = [
    ...grup.flatMap(g => g.items).filter(i => i.href !== "/dashboard/admin").slice(0, 3),
    { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
  ];
  return <MenuLengkap grup={grup} pintasan={penuh ? pintasanTu : pintasanJabatan} {...p} />;
}

export function MenuBendahara(p: PropsMenuPortal) {
  const grup: GrupMenuKisi[] = [{
    label: null,
    items: [
      { href: "/dashboard/bendahara/tagihan", label: "Tagihan", icon: ClipboardList },
      { href: "/dashboard/bendahara/jenis-biaya", label: "Jenis Biaya", icon: LayoutDashboard },
      { href: "/dashboard/bendahara/jadwal", label: "Jadwal Tagihan", icon: CalendarDays },
      { href: "/dashboard/bendahara/laporan", label: "Laporan Penagihan", icon: BarChart2 },
      { href: "/dashboard/bendahara/riwayat", label: "Riwayat Aktivitas", icon: Archive },
      { href: "/dashboard/bendahara/profile", label: "Profil Saya", icon: Users },
    ],
  }];
  return <MenuLengkap grup={grup} {...p} />;
}
