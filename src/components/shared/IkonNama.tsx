"use client";
import Link from "next/link";
import {
  GraduationCap, UserCog, School, Users, Clock, Mail, BookOpen, TrendingUp, NotebookPen, ClipboardCheck, Contact,
  CircleUser, Award, CircleCheck, Briefcase, ShieldCheck, Printer, Receipt, CircleCheckBig, CircleAlert, ClipboardList,
  ListChecks, ChevronRight, CalendarDays, Percent, CalendarX, Stethoscope, CircleX, Library, BookMarked, TriangleAlert,
  Footprints, BookCopy, Wallet, HandCoins, DoorOpen, FileText, ScanLine, LibraryBig, TrendingDown, Gauge, Megaphone, ArrowLeft, Boxes, Hammer, Wrench, FlaskConical, QrCode, Camera } from "lucide-react";

/** Ikon DIPILIH DI SISI KLIEN berdasarkan nama — Pola tampilan v2 (DESIGN_SYSTEM.md §17, CLAUDE.md #35).
 *
 * Di lucide-react 1.x komponen dasar `Icon` bertanda "use client": elemen ikon yang dibuat di HALAMAN SERVER lalu dioper
 * ke komponen klien lain (mis. `<StatTile icon={<Users />}>`, `<Link><Printer /></Link>`) menjadi rujukan klien bertumpuk.
 * Di build produksi hal itu bisa membuat halaman 500 "Element type is invalid … got: object" — dan pemicunya bergeser oleh
 * perubahan kecil apa pun (15 Sep 2026: dashboard Admin; bisect di build lokal: tanpa ikon header, tanpa ikon kartu, tanpa
 * tautan kartu, atau keterangan header teks polos → masing-masing 200). Karena itu halaman server cukup mengirim NAMA ikon. */
const IKON = {
  pengumuman: Megaphone,
  foto: Camera,
  kembali: ArrowLeft,
  aset: Boxes,
  rusak: Hammer,
  perawatan: Wrench,
  lab: FlaskConical,
  qr: QrCode,
  siswa: GraduationCap,
  guru: UserCog,
  kelas: School,
  akun: Users,
  "siswa-wali": Users,
  menunggu: Clock,
  jam: Clock,
  pesan: Mail,
  buku: BookOpen,
  tren: TrendingUp,
  jurnal: NotebookPen,
  absensi: ClipboardCheck,
  kontak: Contact,
  profil: CircleUser,
  prestasi: Award,
  hadir: CircleCheck,
  pkl: Briefcase,
  perisai: ShieldCheck,
  cetak: Printer,
  tagihan: Receipt,
  lunas: CircleCheckBig,
  piutang: CircleAlert,
  "daftar-tugas": ClipboardList,
  "daftar-centang": ListChecks,
  kalender: CalendarDays,
  persen: Percent,
  izin: CalendarX,
  sakit: Stethoscope,
  alpha: CircleX,
  perpustakaan: Library,
  dipinjam: BookMarked,
  peringatan: TriangleAlert,
  kunjungan: Footprints,
  pesanan: BookCopy,
  dompet: Wallet,
  denda: HandCoins,
  pintu: DoorOpen,
  centang: CircleCheckBig,
  waspada: CircleAlert,
  dokumen: FileText,
  pindai: ScanLine,
  pustaka: LibraryBig,
  "poin-turun": TrendingDown,
  "poin-bersih": Gauge,
} as const;

export type NamaIkon = keyof typeof IKON;

export function IkonNama({ nama, size, className }: { nama: NamaIkon; size?: number; className?: string }) {
  const Ikon = IKON[nama];
  return <Ikon size={size} className={className} aria-hidden="true" />;
}

/** Tautan dengan ikon di depan teks (mis. "Cetak Rapor Lengkap"). */
export function TautanIkon({ href, ikon, className, ikonClassName, ukuran = 15, children }: {
  href: string; ikon: NamaIkon; className?: string; ikonClassName?: string; ukuran?: number; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      <IkonNama nama={ikon} size={ukuran} className={ikonClassName} />
      {children}
    </Link>
  );
}

/** Ubin akses cepat (chip ikon + label) untuk panel "Akses Cepat" dashboard. */
export function TautanCepat({ href, label, ikon }: { href: string; label: string; ikon: NamaIkon }) {
  return (
    <Link href={href}
      className="panel-interaktif sentuh flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 text-sm font-semibold text-primary-900 hover:bg-white">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary-700 ring-1 ring-gray-100">
        <IkonNama nama={ikon} size={16} />
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
    </Link>
  );
}

/** Kartu tautan besar (chip ikon + judul + keterangan + panah) — mis. menu utama Bendahara. */
export function KartuTautan({ href, ikon, judul, keterangan }: { href: string; ikon: NamaIkon; judul: string; keterangan: string }) {
  return (
    <Link href={href} className="group panel panel-interaktif masuk-halus sentuh flex items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <IkonNama nama={ikon} size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-heading font-semibold text-primary-900">{judul}</p>
          <p className="text-sm text-gray-500">{keterangan}</p>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-gray-300 transition-colors group-hover:text-primary-700" aria-hidden="true" />
    </Link>
  );
}
