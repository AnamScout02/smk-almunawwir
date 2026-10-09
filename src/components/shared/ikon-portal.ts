import {
  BarChart3, BookMarked, BookOpen, ClipboardList, DatabaseBackup, DoorOpen, FileQuestion, IdCard, LayoutDashboard, Library,
  Radio, ScanLine, Search, Settings2, Trophy, Lightbulb, ClipboardCheck, FileSpreadsheet,
  Users, ListChecks, Megaphone, UserCheck, ArrowRightLeft, Images, UsersRound, Activity, ListTodo, School, Flag, ShieldCheck, LayoutGrid, Target, MapPinned, Building2, TriangleAlert, CalendarRange, Archive, Route, Siren, FileCheck2, Calculator, Map, type LucideIcon,
} from "lucide-react";

/** Ikon & jenis item menu PORTAL (Pusat Ujian, Pusat Perpustakaan, Perpustakaan Digital) — dipakai bottom navbar HP
 * (NavPortal), pita menu tab di bawah header halaman (PitaPortal), dan kisi menu beranda portal (KisiMenuPortal). */
export const IKON = {
  beranda: LayoutDashboard, sirkulasi: ScanLine, kunjungan: DoorOpen, kelola: Library, laporan: BarChart3, peringkat: Trophy,
  katalog: Search, pinjaman: BookMarked, kartu: IdCard, usulan: Lightbulb, opname: ClipboardCheck,
  ujian: FileQuestion, kendali: Radio, administrasi: ClipboardList, panduan: BookOpen, pengaturan: Settings2, data: DatabaseBackup,
  rekap: FileSpreadsheet, analisis: Activity,
  // Pusat SPMB (1 Oktober 2026)
  pendaftar: Users, seleksi: ListChecks, pengumuman: Megaphone, "daftar-ulang": UserCheck,
  konversi: ArrowRightLeft, promosi: Images, perujuk: UsersRound,
  // Tahapan calon siswa (6 Oktober 2026)
  tahapan: ListTodo, sekolah: School,
  // MPLS & Panitia SPMB (7 Oktober 2026)
  mpls: Flag, panitia: ShieldCheck, rombel: LayoutGrid,
  // Sasaran promosi & potensi lulusan SMP/MTs (8 Oktober 2026)
  sasaran: Target,
  // Pusat PKL (9 Oktober 2026)
  penempatan: MapPinned, dudi: Building2, masalah: TriangleAlert, kalender: CalendarRange, arsip: Archive, monitoring: Route, peringatan: Siren, laporanAkhir: FileCheck2, nilaiAkhir: Calculator, petaPkl: Map,
} satisfies Record<string, LucideIcon>;

/** Padanan Material Symbols tiap ikon portal — dipakai bottom navbar HP supaya menu terpilih tampil
 * BERISI (sumbu FILL 1), yang lain hanya garis (permintaan user 18 September 2026). */
export const SIMBOL: Record<keyof typeof IKON, string> = {
  beranda: "home", sirkulasi: "qr_code_scanner", kunjungan: "door_front", kelola: "library_books", laporan: "bar_chart",
  peringkat: "trophy", katalog: "search", pinjaman: "bookmark", kartu: "badge", usulan: "lightbulb", opname: "checklist",
  ujian: "quiz", kendali: "podcasts", administrasi: "assignment", panduan: "menu_book", pengaturan: "settings", data: "database",
  rekap: "table_chart", analisis: "analytics",
  pendaftar: "group", seleksi: "checklist_rtl", pengumuman: "campaign", "daftar-ulang": "how_to_reg",
  konversi: "sync_alt", promosi: "photo_library", perujuk: "group_add", tahapan: "task_alt", sekolah: "school",
  mpls: "flag", panitia: "admin_panel_settings", rombel: "grid_view", sasaran: "ads_click",
  penempatan: "pin_drop", dudi: "apartment", masalah: "report", kalender: "calendar_month", arsip: "inventory_2", monitoring: "route", peringatan: "e911_emergency", laporanAkhir: "task", nilaiAkhir: "calculate", petaPkl: "map",
};

/** `singkat` = label di bottom navbar HP (tempatnya sempit); `persis` = aktif hanya di alamat itu sendiri. Tanpa `persis`, menu
 * juga aktif di halaman turunannya — bila beberapa menu cocok, yang alamatnya PALING SPESIFIK yang aktif (mis. "Daftar Ujian"
 * /pusat-ujian aktif di /pusat-ujian/<id>, tetapi di /pusat-ujian/kendali yang aktif "Ruang Kendali"). */
export type ItemNavPortal = { href: string; label: string; ikon: keyof typeof IKON; persis?: boolean; singkat?: string };
