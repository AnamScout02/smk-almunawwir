#!/usr/bin/env node
/* PEMERIKSA KESERAGAMAN TAMPILAN (27 September 2026).
 *
 * Permintaan user: "fokus penyeragaman semua halaman baik itu tombol2 dan tata letak dan lain2".
 * Sapuan manual selalu luntur karena fitur baru menambah racikan lagi, jadi patokannya dijadikan
 * pemeriksa: `node scripts/cek-keseragaman.mjs` (seluruh src) atau dengan daftar berkas.
 *
 * PENGECUALIAN DI BAWAH SUDAH TERBUKTI, BUKAN DUGAAN — tiap kali audit dijalankan, sekitar separuh
 * temuan ternyata sah (dokumen cetak, matriks padat, lingkaran penghitung, item sidebar, layar TV).
 * Menaruhnya di sini supaya angka yang keluar benar-benar berarti; JANGAN menambah pengecualian
 * baru tanpa memeriksa berkasnya sungguh-sungguh. */
import fs from "node:fs";
import path from "node:path";

const arg = process.argv.slice(2);
const daftar = arg.length ? arg : (() => {
  const out = [];
  (function jelajah(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) jelajah(p); else if (p.endsWith(".tsx")) out.push(p);
    }
  })("src");
  return out;
})();

/** Dokumen cetak & pratinjau kertas: gayanya HARUS tetap (DESIGN_SYSTEM §17.4 butir 7). */
/** Dokumen cetak & pratinjau kertas: gayanya HARUS tetap (DESIGN_SYSTEM §17.4 butir 7).
 *  Penandanya sengaja hanya yang menandai LEMBAR. `PrintKop`/`PrintButton` TERLALU LEMAH — halaman layar
 *  biasa pun punya tombol cetak, dan sekali kata itu muncul seluruh berkas jadi kebal pemeriksaan
 *  (terbukti 27 Sep 2026: JaringanManager lolos hanya karena menyebut PrintButton).
 *  BATASNYA: pengecualian ini per BERKAS, jadi komponen campuran (bagian layar + lembar cetak dalam satu
 *  berkas) tetap harus diperiksa manual. */
const CETAK = s => /print-doc|a4-page|SheetShell|LembarBerhalaman|border border-gray-800|@page/.test(s);
/** Matriks padat & kartu fisik boleh 11px (§17.4 butir 1). */
const PADAT = p => /\/(cetak|print)(-[a-z]+)?\//.test(p) || /Cetak\.tsx$|PrintSheet\.tsx$|Sheet\.tsx$|Sertifikat|Leger|LabelAset/.test(p) || /BukuKlapper|MonthlyAttendanceCalendar|SchedulesManager|TeachingAssignments|DenahRuang|RekapNilaiUjian|BukuInduk|Nominatif|KartuAnggotaDigital|KartuTanda|Barcode|kartu-tanda|kalender-pendidikan\/matriks/.test(p);
/** Papan dinding TV: ukuran hurufnya vh-based, layarnya terkunci setinggi layar (CLAUDE.md #81). */
const PAPAN = p => /PapanLayar|PapanPegawai|DindingLayar|\/layar\/|bel-sekolah\/player|LayarQr|AbsensiScanStation/.test(p);
/** Lingkaran penghitung kecil & pangkat: sengaja kecil. */
/** Portal (dashboard & pusat-*) — situs publik sengaja lebih tebal, tidak ikut aturan judul portal. */
const PORTAL = p => /^src\/app\/dashboard\/|^src\/app\/pusat-/.test(p) || (/^src\/components\//.test(p) && !/^src\/components\/(sections|layout)\//.test(p));
const LINGKARAN = b => /min-w-\[1[4-9]px\]|h-\[1[4-9]px\]|w-5 h-5|h-5 w-5|w-4 h-4|inset-1\.5|<sup|rounded-full px-1\.5/.test(b);
/** Kelas tombol yang memang bukan tombol aksi portal. */
const TOMBOL_SAH = [
  /(^|\s)p-1\.5(\s|$)/, /(^|\s)p-2 rounded-lg/, /^inline-flex p-1\.5 /,        // aksi baris tabel §15.2 (urutan kelasnya bebas)
  /^w-full flex items-center gap-3 px-3 py-/,                                  // item sidebar / menu akun
  /^fixed top-4 right-4 z-50/,                                                 // tombol melayang §15.5
  /border border-white\//,                                                     // kembali di kepala PortalShell §4.1
  /bg-amber-950/,                                                              // pita impersonasi
  /hover:bg-amber-50/,                                                         // baris daftar, bukan tombol
  /^flex items-center gap-3 rounded-2xl border border-(primary-100|amber-200)/, // kartu layar ujian
];

const temuan = [];
const catat = (p, no, kat, ket) => temuan.push({ p, no, kat, ket });

for (const p of daftar) {
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, "utf8");
  const cetak = CETAK(p) || CETAK(s);
  const baris = s.split("\n");

  baris.forEach((b, i) => {
    const no = i + 1;
    const kertas = cetak && /print|border-gray-800/.test(b);

    // Tombol racikan
    for (const m of b.matchAll(/className=(?:"|\{`)([^"`]*)/g)) {
      const c = m[1];
      if (!/\bbg-(primary|emerald|amber|blue|red|gold|navy|indigo|purple|teal)-\d/.test(c)) continue;
      if (!/\brounded-/.test(c) || !/\bp[xy]?-/.test(c)) continue;
      if (/btn-|alat-tab|kartu-menu|pintasan-item|panel-interaktif|status-badge|\bbadge\b/.test(c)) continue;
      if (TOMBOL_SAH.some(r => r.test(c))) continue;
      if (!/<(button|Link|a)\b/.test(b)) continue;
      catat(p, no, "tombol-racikan", c.slice(0, 60));
    }
    // Kelas berlebih pada tombol baku (§4.1)
    const baku = b.match(/className=(?:"|\{`)([^"`]*btn-(?:modal-save|modal-cancel|hapus|awas)[^"`]*)/);
    if (baku) {
      const lebih = ["text-sm", "px-4", "py-2.5", "gap-2", "items-center", "rounded-xl"].filter(x => new RegExp(`(?<![\\w:-])\\b${x}\\b`).test(baku[1]));
      if (lebih.length) catat(p, no, "kelas-berlebih", lebih.join(" "));
    }
    // Huruf di bawah 12px di layar
    if (!cetak && !PADAT(p) && !PAPAN(p) && !LINGKARAN(b) && !/\bprint:/.test(b)
        && /text-\[(9|10|11)px\]|text-\[0\.6\d*rem\]/.test(b)) catat(p, no, "huruf-<12px", b.trim().slice(0, 60));
    // Kartu racikan (§5.7 → .panel)
    if (!/print-doc|print:border-0|a4-page/.test(b) && /bg-white rounded-2xl border border-gray-100 shadow-sm/.test(b))
      catat(p, no, "kartu-racikan", "→ .panel");
    // Pita tab abu (patokan Kurikulum §19: putih bergaris)
    if (/alat-tab[^"`]*bg-gray-100/.test(b)) catat(p, no, "pita-tab-abu", "→ border border-gray-100 bg-white");
    if (/alat-tab/.test(b) && /hover:bg-white/.test(b)) catat(p, no, "hover-putih-di-pita-putih", "→ hover:bg-gray-50");
    // vh bukan dvh (§17.4 butir 4) — h-screen pada <aside> desktop tetap wajib
    if (/min-h-screen/.test(b)) catat(p, no, "vh-bukan-dvh", "→ min-h-dvh");
    // Jarak bawah baku blok (§3.1 & §4.1): kartu angka, baris alat, baris aksi = mb-5
    for (const [pola, nama] of [[/kisi-kartu[^"`]*?\bmb-(?!5\b)\d+/, "kisi-kartu"],
                                [/baris-alat[^"`]*?\bmb-(?!5\b)\d+/, "baris-alat"],
                                [/alat-aksi justify-end[^"`]*?\bmb-(?!5\b)\d+/, "alat-aksi"]])
      if (pola.test(b)) catat(p, no, "jarak-blok-bukan-mb-5", nama);
    // Judul kartu/seksi di PORTAL: bobot 600 seperti .panel-judul & Dashboard Kurikulum (§19)
    if (PORTAL(p) && !cetak && /<h[2-5][^>]*className="[^"]*font-heading font-bold text-(primary-900|navy)/.test(b))
      catat(p, no, "judul-kartu-bold", "→ font-semibold");
    // Spinner (§15.1 & patokan Kurikulum): blok memuat = Loader2 abu ukuran 24
    if (!PAPAN(p)) {
      // Spinner SEBARIS menyesuaikan ikon sebelahnya (11–22px) dan itu benar; yang salah hanya spinner
      // BLOK yang dibuat lebih besar dari patokan 24.
      if (/<Loader2 size=\{(2[89]|[3-9]\d)\}[^>]*animate-spin/.test(b)) catat(p, no, "spinner-ukuran", "blok memuat → size 24");
      if (/animate-spin[^"]*text-primary-\d/.test(b)) catat(p, no, "spinner-warna", "→ text-gray-400 (tanpa warna bila di dalam tombol gelap)");
    }
    // Token primary yang tidak ada di @theme
    const tk = b.match(/primary-(200|400|600|800)\b/);
    if (tk) catat(p, no, "token-primary-hantu", tk[0]);
    // Isian bawaan peramban
    if (/<select\b/.test(b) && !/SoalTampil/.test(p)) catat(p, no, "select-native", "→ <Select>");
    if (/<input[^>]*type="(date|month|time)"/.test(b) && !/DatePicker|MonthPicker|TimePicker|BukuIndukField/.test(p)) catat(p, no, "input-tanggal-native", "→ DatePicker/MonthPicker/TimePicker");
    if (/window\.confirm/.test(b) && !/ConfirmProvider/.test(p)) catat(p, no, "confirm-native", "→ useConfirm()");
  });


  /* Pesan "Belum ada…/Tidak ada…" di latar terang: 14px, satu warna, blok tengah selalu py-10 (§19.3).
     Dokumen cetak, matriks padat, dan papan TV dikecualikan. */
  if (!cetak && !PADAT(p) && !PAPAN(p)) for (const m of s.matchAll(/<(?:p|div) className="([^"]*)"\s*>\s*\{?\s*(?:Belum ada|Tidak ada)/g)) {
    const k = m[1];
    if (/text-white/.test(k)) continue;                       // papan TV & kiosk punya skala sendiri
    const no = s.slice(0, m.index).split("\n").length;
    const warna = k.match(/text-(gray|emerald|amber|red|blue|primary|purple|indigo|teal|gold)-\d+/g) ?? [];
    if (warna.length === 0) catat(p, no, "pesan-kosong", "warna teks tidak disebut");
    if (warna.length > 1) catat(p, no, "pesan-kosong", "dua warna teks bertumpuk: " + warna.join(" "));
    if (/(?<![\w:-])text-xs(?![\w-])/.test(k)) catat(p, no, "pesan-kosong", "→ text-sm");
    if (/text-center/.test(k) && /(?<![\w:-])py-(?!10\b)\d+/.test(k)) catat(p, no, "pesan-kosong", "blok tengah → py-10");
  }

  /* Urutan isi (§19.5): di halaman yang punya kartu angka, KARTU adalah blok pertama —
     baris alat/pintasan tidak boleh mendahuluinya. Pemberitahuan & BarisKembali dikecualikan. */
  if (/kisi-kartu/.test(s) && /<PageHeader/.test(s)) {
    const mh = s.match(/<PageHeader[\s\S]*?\/>\s*\n/);
    if (mh) {
      const sisa = s.slice(mh.index + mh[0].length);
      const iAlat = sisa.search(/<div className="(?:alat-aksi|baris-alat)[^"]*"|<div className="grid grid-cols-2 gap-3 lg:grid-cols-4/);
      const iKartu = sisa.search(/<div className="kisi-kartu/);
      /* Jarak dibatasi: kartu angka yang letaknya JAUH di bawah bukan ringkasan halaman melainkan
         statistik satu seksi (mis. rekap riwayat di Kedisiplinan Guru), dan baris alat di atas memang
         milik seksi lain — bukan pelanggaran urutan. */
      const jauh = iKartu - iAlat > 2500;
      if (iAlat >= 0 && iKartu >= 0 && iAlat < iKartu && !jauh)
        catat(p, s.slice(0, mh.index + mh[0].length + iAlat).split("\n").length, "urutan-kartu-dulu", "baris alat/pintasan mendahului kartu angka");
    }
  }
  // Grid kartu angka (§5.3)
  for (const m of s.matchAll(/className="((?:(?!").)*grid-cols(?:(?!").)*)"[\s\S]{0,200}?<StatTile((?:(?!\/>).)*)/g))
    if (!/kisi-kartu/.test(m[1]) && !/tampilan="gradien"/.test(m[2]))
      catat(p, 0, "grid-kartu-angka", "→ .kisi-kartu");
  // PageHeader dibungkus print:hidden sendirian (gotcha #24)
  if (!/components\/admin\/PageHeader\.tsx$/.test(p) && /<div className="print:hidden">\s*<PageHeader/.test(s)) catat(p, 0, "pageheader-dibungkus", "→ prop printHidden");
  // Tabel layar tanpa wadah overflow (§5.7 freeze)
  if (!cetak) for (const m of s.matchAll(/<table/g)) {
    const atas = s.slice(Math.max(0, m.index - 700), m.index);
    if (!/overflow-(x-)?auto/.test(atas) && !/<Modal/.test(atas)) { catat(p, 0, "tabel-tanpa-overflow", "→ bungkus overflow-x-auto"); break; }
  }
}

if (!temuan.length) { console.log("Keseragaman: tidak ada temuan."); process.exit(0); }
const per = {};
for (const t of temuan) (per[t.kat] ??= []).push(t);
for (const k of Object.keys(per).sort()) {
  console.log(`\n${k} (${per[k].length})`);
  for (const t of per[k]) console.log(`  ${t.p}${t.no ? ":" + t.no : ""}  ${t.ket}`);
}
console.log(`\nTOTAL ${temuan.length} temuan di ${new Set(temuan.map(t => t.p)).size} berkas`);
process.exit(1);
