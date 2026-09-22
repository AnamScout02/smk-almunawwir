/** Ikon Material Symbols yang dipakai bottom navbar (MobileBottomNav) — SATU SUMBER untuk:
 *  - tautan Google Fonts di src/app/layout.tsx (`&icon_names=`): font HANYA berisi ikon ini (±7 KB, bukan ±4 MB
 *    font lengkap yang dulu ikut dimuat di SETIAP halaman — di HP berkuota lambat ikon tampil sebagai tulisan
 *    "fact_check", "school" sampai selesai terunduh; temuan audit HP 21 Sep 2026),
 *  - MobileBottomNav: `simbol` yang TIDAK ada di daftar ini memakai ikon lucide (bukan tulisan).
 * Menambah `simbol` baru di menu/peta SIMBOL → tambahkan juga di sini (urut abjad, syarat API Google Fonts). */
export const SIMBOL_DIPAKAI = [
  "assignment", "badge", "bar_chart", "bookmark", "calendar_month", "campaign", "checklist", "database", "description",
  "door_front", "edit_note", "event_available", "event_busy", "fact_check", "groups", "history", "home", "library_books",
  "lightbulb", "local_library", "mail", "menu_book", "podcasts", "qr_code_scanner", "quiz", "receipt_long", "school",
  "search", "settings", "table_chart", "trophy",
] as const;

export const URL_FONT_SIMBOL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0"
  + `&icon_names=${[...SIMBOL_DIPAKAI].sort().join(",")}&display=block`;

const SET = new Set<string>(SIMBOL_DIPAKAI);
export const simbolTersedia = (nama?: string | null): nama is string => !!nama && SET.has(nama);
