import {
  BarChart3, BookMarked, BookOpen, ClipboardList, DatabaseBackup, DoorOpen, FileQuestion, IdCard, LayoutDashboard, Library,
  Radio, ScanLine, Search, Settings2, Trophy, Lightbulb, ClipboardCheck, FileSpreadsheet, type LucideIcon,
} from "lucide-react";

/** Ikon & jenis item menu PORTAL (Pusat Ujian, Pusat Perpustakaan, Perpustakaan Digital) — dipakai bottom navbar HP
 * (NavPortal), pita menu tab di bawah header halaman (PitaPortal), dan kisi menu beranda portal (KisiMenuPortal). */
export const IKON = {
  beranda: LayoutDashboard, sirkulasi: ScanLine, kunjungan: DoorOpen, kelola: Library, laporan: BarChart3, peringkat: Trophy,
  katalog: Search, pinjaman: BookMarked, kartu: IdCard, usulan: Lightbulb, opname: ClipboardCheck,
  ujian: FileQuestion, kendali: Radio, administrasi: ClipboardList, panduan: BookOpen, pengaturan: Settings2, data: DatabaseBackup,
  rekap: FileSpreadsheet,
} satisfies Record<string, LucideIcon>;

/** Padanan Material Symbols tiap ikon portal — dipakai bottom navbar HP supaya menu terpilih tampil
 * BERISI (sumbu FILL 1), yang lain hanya garis (permintaan user 18 September 2026). */
export const SIMBOL: Record<keyof typeof IKON, string> = {
  beranda: "home", sirkulasi: "qr_code_scanner", kunjungan: "door_front", kelola: "library_books", laporan: "bar_chart",
  peringkat: "trophy", katalog: "search", pinjaman: "bookmark", kartu: "badge", usulan: "lightbulb", opname: "checklist",
  ujian: "quiz", kendali: "podcasts", administrasi: "assignment", panduan: "menu_book", pengaturan: "settings", data: "database",
  rekap: "table_chart",
};

/** `singkat` = label di bottom navbar HP (tempatnya sempit); `persis` = aktif hanya di alamat itu sendiri. Tanpa `persis`, menu
 * juga aktif di halaman turunannya — bila beberapa menu cocok, yang alamatnya PALING SPESIFIK yang aktif (mis. "Daftar Ujian"
 * /pusat-ujian aktif di /pusat-ujian/<id>, tetapi di /pusat-ujian/kendali yang aktif "Ruang Kendali"). */
export type ItemNavPortal = { href: string; label: string; ikon: keyof typeof IKON; persis?: boolean; singkat?: string };
