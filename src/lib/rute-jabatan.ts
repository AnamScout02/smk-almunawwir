/** TAUTAN DASHBOARD JABATAN YANG BENAR PER PORTAL (25 September 2026).
 *
 * Bug yang diperbaiki: superadmin membuka Dashboard BKK dari portalnya sendiri, menekan "Tracer Study", lalu
 * mendarat di `/dashboard/teacher/bkk/tracer-study` — kepala halaman berubah jadi Portal Guru dan sidebarnya
 * nyaris kosong (laporan user 24 Sep 2026). Penyebabnya 43 tautan yang DITULIS MATI ke `/dashboard/teacher/...`
 * di dalam komponen `src/components/jabatan/*`, padahal komponen yang sama dipakai DUA portal (CLAUDE.md #55).
 *
 * **Kenapa tidak cukup menukar awalannya saja.** Halaman pengawasan di portal admin sengaja diletakkan di grup
 * FUNGSINYA masing-masing, bukan meniru struktur portal guru — "Buku Piket" ada di grup Kepegawaian, "Poin Siswa"
 * di grup Kesiswaan, dan seterusnya. Dari 34 tujuan, hanya 8 yang kebetulan berjalur sama; menukar awalan mentah
 * akan melahirkan 26 halaman 404. Karena itu padanannya ditulis tegas di sini.
 *
 * Menambah tautan baru di komponen jabatan: pakai `tautanJabatan(basePath, "jalur/guru")`, dan kalau jalur itu
 * belum ada di peta, DAFTARKAN dulu padanan adminnya. Jalur yang tidak terdaftar akan jatuh ke portal guru —
 * aman untuk guru, tetapi itulah bug aslinya bagi superadmin. */

/** Jalur RELATIF portal guru → jalur RELATIF portal admin. Kunci tanpa garis miring di depan. */
const PADANAN_ADMIN: Record<string, string> = {
  // Kehadiran & kesiswaan
  "absensi-scan": "absensi-siswa/scan",
  "kesiswaan/papan": "papan-kesiswaan",
  "kesiswaan/poin-siswa": "poin-siswa",
  "kesiswaan/rekam-bk": "rekam-bk",
  "piket/poin-siswa": "poin-siswa",

  // Kurikulum
  "wakasek/kurikulum/jadwal": "schedules",
  "wakasek/kurikulum/mapel": "subjects",
  "wakasek/kurikulum/penugasan": "teaching-assignments",
  "rapor-kelas/cetak": "rapor-cetak",
  "kepala-sekolah/rapor": "pengesahan-rapor",

  // Kepegawaian & penjaminan mutu
  "wakasek/penjamin-mutu/jadwal-piket": "jadwal-piket",
  "wakasek/penjamin-mutu/kedisiplinan": "kedisiplinan-guru",

  // Sarana prasarana
  "wakasek/sarpras": "dashboard-jabatan/sarpras",
  "wakasek/sarpras/inventaris": "inventaris",

  // Kaprogli & UKK
  "wakasek/kaprogli": "dashboard-jabatan/kaprogli",
  "wakasek/kaprogli/ukk": "rekap-ukk",

  // Humas, BKK, mitra
  "humas/industry-partners": "industry-partners",
  "humas/pkl-pendaftaran": "pkl-pendaftaran",
  "humas/tracer-study": "tracer-study",
  "bkk/tracer-study": "tracer-study",
  "kepala-sekolah/mitra": "mitra-mou",

  // Website & informasi
  "branding/banners": "banners",
  "branding/gallery": "gallery",
  "branding/liputan": "liputan",
  "branding/news": "news",

  // Dashboard jabatan itu sendiri
  "kepala-sekolah": "dashboard-jabatan/kepala-sekolah",
};

/** Jalur yang kebetulan SAMA di kedua portal — didaftarkan supaya jelas sudah diperiksa, bukan terlewat. */
const SAMA = new Set([
  "aspirasi", "ekstrakurikuler", "izin-siswa", "kegiatan",
  "kinerja-pimpinan", "konseling", "peringatan-dini", "tata-tertib",
]);

export const BASE_GURU = "/dashboard/teacher";
export const BASE_ADMIN = "/dashboard/admin";

/** Alamat tujuan yang benar untuk portal yang sedang dipakai.
 * `jalur` selalu ditulis dalam istilah portal GURU (itu yang sudah ada di kode), termasuk query-nya. */
export function tautanJabatan(basePath: string, jalur: string): string {
  const bersih = jalur.replace(/^\/+/, "");
  if (basePath !== BASE_ADMIN) return `${BASE_GURU}/${bersih}`;

  // Query dipisah dulu: padanan dicocokkan dari JALUR-nya saja, query dibawa apa adanya.
  const potong = bersih.indexOf("?");
  const inti = potong < 0 ? bersih : bersih.slice(0, potong);
  const query = potong < 0 ? "" : bersih.slice(potong);

  if (SAMA.has(inti)) return `${BASE_ADMIN}/${inti}${query}`;
  const padanan = PADANAN_ADMIN[inti];
  // Belum terdaftar → tetap ke portal guru. Superadmin akan melihat shell guru (bug aslinya), tetapi itu jauh
  // lebih baik daripada mengarahkan ke halaman admin yang tidak ada dan berakhir 404.
  return padanan ? `${BASE_ADMIN}/${padanan}${query}` : `${BASE_GURU}/${bersih}`;
}
