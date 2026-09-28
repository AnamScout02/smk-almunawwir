# Design System — SMK Al-Munawwir IIBS

**Status: WAJIB DIPATUHI.** Dokumen ini adalah patokan tunggal untuk font, warna, layout,
komponen, tabel, dropdown, tombol, pagination, cetak, dan pola pengambilan data di seluruh
aplikasi. Setiap halaman baru atau perubahan halaman lama WAJIB mengikuti dokumen ini —
tujuannya supaya tidak ada dua halaman yang menerapkan hal yang sama dengan cara berbeda.

Semua nilai di sini diambil LANGSUNG dari kode yang sudah berjalan di produksi (bukan
rekomendasi teoretis) — kalau ada konflik antara dokumen ini dan kode nyata, itu tandanya salah
satunya perlu diperbaiki, bukan diabaikan. Dokumen ini melengkapi (bukan menggantikan) 24
gotcha di `CLAUDE.md` — baca keduanya.

---

## 0. Prinsip Dasar

1. **Jangan reinvent.** Sebelum menulis CSS/komponen baru, cek dulu apakah sudah ada utility
   class (`@layer components` di `globals.css`) atau komponen shared (`src/components/admin/`,
   `src/components/shared/`) yang bisa dipakai langsung.
2. **Satu sumber kebenaran per konsep.** Warna jurusan dari `Major` (bukan hardcode), semester
   dari `generateSemesters()` (bukan hardcode), kelas wali dari `teacher.homeroomOf` (bukan
   query bebas) — lihat gotcha #9, #10, #11 di `CLAUDE.md`.
3. **Konsisten > kreatif.** Halaman admin baru harus terlihat seperti "saudara kandung" halaman
   admin lain, bukan didesain ulang dari nol. Variasi visual antar halaman = bug, bukan fitur.
4. **Verifikasi visual, bukan cuma baca kode.** Untuk perubahan layout/posisi (sticky, overlap,
   z-index), pola `position: sticky` pernah gagal tanpa error apapun (gotcha #24) — kalau ragu,
   pakai Playwright headless untuk screenshot sungguhan, jangan percaya `getComputedStyle` saja.

---

## 1. Font & Tipografi

Diatur di `src/app/layout.tsx` (load font) + `src/app/globals.css` (mapping token).

| Token CSS | Font | Dipakai untuk |
|---|---|---|
| `--font-heading` (`font-heading`) | Plus Jakarta Sans | Semua `h1`–`h6`, judul kartu, judul modal, nilai `StatTile` |
| `--font-body` (default `body`) | Inter | Teks biasa, paragraf, label, isi tabel |
| `--font-arabic` (`font-arabic`) | Amiri | Kutipan/teks Arab (`IslamicQuote`, dll) — WAJIB `line-height: 2.2` untuk ruang harakat |
| Material Symbols Outlined | via `<link>` Google Fonts di `<head>` | Ikon bertema Material (jarang; ikon utama tetap lucide-react) |

`h1`–`h6` otomatis pakai `font-heading` lewat `@layer base` — tidak perlu tambah class manual
kalau memang elemen heading asli. Kalau butuh tampilan heading tapi elemen bukan `<h*>`
(mis. `<span>`/`<p>` di kartu), tambahkan `font-heading font-bold` manual.

**Skala ukuran umum** (dari pola kode nyata, bukan skala Tailwind default penuh):
- Judul halaman (`PageHeader`): default heading size bawaan (`text-lg`/`text-xl` di dalam komponen).
- Judul modal (`Modal`): tidak di-set eksplisit besar → mengikuti `h2` default + `font-heading font-semibold`.
- Nilai besar `StatTile`: `text-3xl` (size="lg", default), `text-2xl` (size="md"), `text-sm line-clamp-2` (size="sm" — dipakai kalau isi bisa jadi teks panjang, mis. nama identitas).
- Body/tabel: `text-sm` adalah default de-facto di hampir semua tabel & form admin.
- Label form: `text-sm font-medium` (lihat `.label-field`).
- Badge/status: `text-xs`–`text-[0.7rem]`, huruf kapital + `letter-spacing` lebar (lihat §5).

Import wajib di komponen yang pakai `React.ElementType` sebagai prop tipe (ikon dinamis, dll):
```ts
import React, { useState } from "react"; // bukan: import { useState } from "react";
```
(Gotcha #? — React 19 butuh `React` diimpor eksplisit kalau `React.ElementType` dipakai sebagai tipe.)

---

## 2. Warna (Theme Tokens)

Didefinisikan via `@theme` di `globals.css`. **JANGAN PERNAH** pakai `primary-800` — token itu
TIDAK ADA (insiden nyata: elemen jadi invisible karena Tailwind diam-diam tidak generate class
untuk token yang tidak terdaftar). Token primary yang valid: `50, 100, 300, 500, 700, 900` saja
(loncat, bukan skala 100-900 penuh). Disapu 15 Sep 2026: 207 pemakaian `primary-200/400/600/800` di 118 berkas diganti
`100/500/700/900` (gejala nyata: ikon kartu "Boarding 24 Jam" di beranda tampak berkilau karena ujung gradiennya kosong).

| Token | Hex | Pemakaian umum |
|---|---|---|
| `primary-50` | `#EEF0F8` | Background hover row/aktif ringan (mis. opsi terpilih di `Select`) |
| `primary-100` | `#CBD1E9` | Border/ring lembut |
| `primary-300` | `#7A88C4` | Scrollbar thumb (`.scrollbar-visible`) |
| `primary-500` | `#2E3F8F` | Focus ring input (`.input-field:focus`) |
| `primary-700` | `#1B2B6B` | Warna utama tombol/aksen (`btn-primary`, `btn-modal-save`) |
| `primary-900` | `#0F1A45` | Navy paling gelap — teks utama, gradient header, hover tombol |
| `gold` | `#E8A020` | Aksen premium (badge, ikon grup, shimmer button) |
| `gold-light` | `#F5C842` | Ujung gradient gold |
| `gold-dark` | `#B87D0E` | Hover gold, teks `badge-gold` |
| `cream` | `#F8F7F2` | Background dasar body |
| `navy` | `#0F1A45` | Sama dengan primary-900 (alias semantik) |

**Gradient navy standar** (header `PageHeader`, `Modal`, bottom navbar) — SELALU
pakai gradient 3-stop ini, jangan bikin gradient navy baru yang beda:
```css
linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)
```
Ditambah watermark opsional: `background-image: url('/images/pattern-smk.png')`, `background-size: 140px 140px`, `filter: invert(1)`, `opacity: 0.06` (di dalam header/modal) — `opacity: 0.07`, `background-size: 180px 180px` (di section hero publik `.from-primary-900`).

**Warna status kehadiran** (HADIR/IZIN/SAKIT/ALPHA) — konvensi tetap dipakai di semua halaman
absensi (`teacher/attendance/[classId]/page.tsx` dan turunannya):
```ts
HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
IZIN:  "bg-blue-50 text-blue-700 border-blue-200",
SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
ALPHA: "bg-red-50 text-red-600 border-red-200",
```
Kalau menambah status baru di modul lain, ikuti pola ini: `bg-{color}-50 text-{color}-700 border-{color}-200`, JANGAN pakai warna solid pekat untuk badge status.

**Warna varian `Alert`** (`src/components/admin/Alert.tsx`):
```ts
info:    bg-blue-50    border-blue-200    / text-blue-600(icon) text-blue-800(title) text-blue-700(body)
warning: bg-amber-50   border-amber-200   / text-amber-600      text-amber-800      text-amber-700
success: bg-emerald-50 border-emerald-200 / text-emerald-600    text-emerald-800    text-emerald-700
error:   bg-red-50     border-red-200     / text-red-600        text-red-800        text-red-700
```
Ini pola warna acuan untuk SEMUA kotak notice bertema (bukan cuma komponen `Alert` — kalau
menulis notice manual tanpa komponen, tetap ikuti pasangan warna 50/200/600/700/800 ini).

**Warna `StatTile`** (7 varian tetap): `primary, emerald, amber, blue, red, purple, gray` — tiap
varian = `from-{color}-500 to-{color}-600/700` + `ring-{color}-100`. Jangan bikin warna gradient
baru di luar 7 ini untuk kartu ringkasan angka; tambah varian baru ke `COLOR_STYLES` di
`StatTile.tsx` kalau memang perlu warna ke-8.

**Warna jurusan (Major)** — dinamis per jurusan (`major.themeColor`, hex disimpan di DB), JANGAN
hardcode warna per jurusan di komponen manapun. Pakai helper `src/lib/color.ts`:
- `themeGradient(hex)` — gradient "to bottom right" 3-stop (kartu besar, ikon jurusan).
- `themeGradientRight(hex)` — gradient "to right" (badge/tombol kecil).
- `withAlpha(hex, percent)` — tambah alpha ke hex, mis. `withAlpha("#1B2B6B", 10)`.

**Warna jabatan Wakasek** (`src/lib/wakasek-colors.ts`) — `colorForJabatan(name)`: 5 warna tetap
untuk "Wakil Kepala *" yang sudah dikenal, fallback HSL golden-angle untuk jabatan baru (supaya
tetap konsisten & tidak tabrakan warna tanpa perlu didaftarkan manual).

---

## 3. Layout Halaman

### 3.1 Wrapper halaman dashboard standar
Setiap halaman di bawah `/dashboard/admin/**`, `/dashboard/teacher/**` yang render `PageHeader`
WAJIB dibungkus persis pola ini (kompensasi negative-margin `PageHeader` terhadap padding
kontainer):
```tsx
<div className="p-6 lg:p-8 pt-16 lg:pt-8">
  <PageHeader icon={<Icon size={22} />} title="..." description="..." />
  {/* tombol aksi (kalau ada) di baris terpisah tepat di bawah PageHeader */}
  <div className="flex justify-end mb-5">...</div>
  {/* konten halaman */}
</div>
```

### 3.2 `PageHeader` (`src/components/admin/PageHeader.tsx`)
**HANYA** `icon` + `title` + `description` + `printHidden` (boolean). **TIDAK ADA** prop
`actions`/tombol/dropdown di dalamnya — ini aturan eksplisit user, dilanggar berkali-kali di
masa lalu makanya sengaja dihapus dari tipe komponen. Header ini `sticky top-0 z-30` dengan
gradient navy 3-stop yang sama seperti §2. Kalau halaman butuh tombol cetak/tambah data,
taruh di `<div className="flex justify-end mb-5">` PERSIS DI BAWAH `<PageHeader />`, jangan di
dalamnya, dan JANGAN bungkus `<PageHeader/>` sendirian dalam `<div className="print:hidden">`
(merusak sticky — gotcha #24) — pakai prop `printHidden` langsung:
```tsx
<PageHeader icon={<Icon size={22}/>} title="..." printHidden />
```

### 3.3 Header landing tiap portal — SAMA dengan `PageHeader` biasa (bukan "hero" custom lagi)
**Keputusan eksplisit user 2026-08-23, MEMBALIK pola lama** yang pernah didokumentasikan di sini:
`/dashboard/admin/page.tsx`, `/dashboard/teacher/page.tsx`, `/dashboard/student/page.tsx` DULU
punya header custom lebih besar ("hero" — gradient + sapaan + tanggal + badge notifikasi,
`sticky top-14 lg:top-0 z-30` manual). User menilai ini keliatan "tidak sama seperti halaman
lain" dibanding `PageHeader` yang dipakai semua halaman fitur (mis. Buku Mutasi Siswa) — jadi
SEKARANG ketiga halaman dashboard ini WAJIB pakai `<PageHeader icon={...} title="..."
description={...} />` yang PERSIS SAMA seperti halaman lain (§3.2), bukan blok custom lagi:
```tsx
<div className="p-6 lg:p-8 pt-16 lg:pt-8">
  <PageHeader icon={<LayoutDashboard size={22}/>} title="Dashboard Administrator"
    description={<>Selamat datang, <span className="font-medium">{session.name}</span> — {dateStr}</>} />
  <div className="space-y-5">{/* ...konten... */}</div>
</div>
```
- `title` tetap pola "nama fitur" (mis. "Dashboard Administrator"/"Dashboard Guru"/"Dashboard
  Siswa"), BUKAN nama orang — nama/salam/tanggal/identitas kelas dipindah ke `description`.
- Badge notifikasi interaktif yang dulu nempel di header (mis. "X pesan baru" bisa diklik) HARUS
  DIHAPUS dari sini (bukan kehilangan fungsi — count yang sama sudah ada di badge sidebar) krn
  `PageHeader` sengaja tidak boleh punya elemen interaktif (gotcha #16).
- Salam Arab (mis. `اَلسَّلَامُ عَلَيْكُمْ`) boleh tetap ada di `description` (pakai `font-arabic`
  + `lineHeight: 2.2` inline di span-nya) ATAU di section terpisah DI BAWAH header kalau memang
  konten berbeda (bukan duplikat) — lihat `dashboard/student/page.tsx` (section "Greeting" tetap
  ada terpisah, cuma bagian navy hero-nya yang diganti `PageHeader`).
- Karena sekarang pakai `PageHeader` yang sudah `sticky top-0` bawaan (bukan `top-14`/`top-16`
  manual lagi), TIDAK PERLU lagi override `top-*` khusus per-portal — cukup ikuti wrapper standar
  `p-6 lg:p-8 pt-16 lg:pt-8` (§3.1) apa adanya di ketiga halaman ini juga.

### 3.4 Sidebar (DESKTOP — `lg:` ke atas)
`AdminSidebar`, `TasSidebar`, `TeacherSidebar`, `StudentSidebar` — semua, KHUSUS tampilan
`<aside>` desktop (mobile pakai `MobileBottomNav`, lihat §3.6 — bukan lagi hamburger+drawer):
- `<aside>` desktop: **`sticky top-0 h-screen shrink-0`** — JANGAN `fixed` (melepas dari alur
  dokumen, bikin overlap dengan `ImpersonationBanner` pita oranye). Kalau `sticky`, JANGAN
  tambah `lg:ml-<lebar>` kompensasi di `<main>` (itu hanya perlu untuk `fixed`).
- Menu dikelompokkan (`menuGroups: {label, items}[]`, `label: null` untuk item root seperti
  Dashboard), model accordion (`openGroups: Set`, satu grup terbuka pada satu waktu).
- **Semua grup TERTUTUP di awal login/muat halaman**, KECUALI grup yang memuat halaman aktif
  saat itu — sengaja TIDAK ADA restore dari localStorage, ini keputusan eksplisit, jangan
  ditambah lagi.
- `ALL_HREFS` gabungan semua href untuk disambiguasi prefix — `isActive` hanya anggap href
  PALING SPESIFIK (terpanjang) yang aktif.
- `activeGroupLabel()` dipanggil di 2 `useEffect` (mount + `pathname` berubah).
- Badge notifikasi dikirim sebagai props serializable dari server component layout (bukan
  fetch di client) — lihat pola `unreadMessages`, `pendingAdmissions`, `missingAttendanceClasses`
  di `AdminSidebar`.

### 3.5 Kartu & Container
| Class | Pemakaian |
|---|---|
| `.page-card` | Kontainer putih rounded untuk sub-halaman admin (rounded-2xl, border tipis, shadow halus) |
| `.page-card-header` | Header dalam `.page-card` (flex justify-between, border-bottom) |
| `.stat-card` | Kartu statistik dengan hover accent bar gradient navy→gold di atas |
| `.card-glass` | Kartu efek glass/blur (backdrop-blur, dipakai di section publik/hero) |
| `.card-premium` | Kartu putih premium dengan hover lift (section publik) |
| `GroupedSection` | Kartu grup tabel dgn kepala TERANG (chip ikon + judul navy + chip jumlah, sejak 15 Sep 2026) — dipakai HAMPIR SEMUA tabel admin yang dikelompokkan (lihat §5) |
| `EmptyState` | Kondisi "belum ada data" (ikon abu-abu + teks tengah, py-16) |

### 3.6 Navigasi MOBILE — bottom navbar 5 slot + kisi menu di dashboard (18 September 2026)
**Keputusan user 18 September 2026 (contoh yang dikirim: Livin' by Mandiri & BRImo), MEMBALIK pola
"4 slot + BottomSheet" 22 Agustus 2026:** di HP tidak ada lagi laci menu. Yang berlaku sekarang:

- **`MobileBottomNav`** (`src/components/shared/MobileBottomNav.tsx`) — bar `fixed bottom-0` (`z-50`,
  `lg:hidden`), LATAR PUTIH (bukan navy lagi) dengan garis atas tipis: `items` = **4 tautan langsung**
  (dua kiri, dua kanan) + **`beranda`** = tombol BULAT MENONJOL di tengah (lingkaran navy bergradien,
  cincin putih) menuju dashboard portal. Tidak ada prop `slots`/`kind: "sheet"` lagi — jangan
  dihidupkan kembali.
- **Seluruh menu ada di dashboard** sebagai kisi ikon (`MenuLengkap`, §5.8) + halaman
  `/dashboard/<portal>/menu` ("Lihat semua", berisi kotak **Cari menu** dan semua grup).
- **Satu sumber menu**: tiap Sidebar mengekspor pembangun grupnya (`grupMenuSiswa`, `grupMenuGuru`,
  `grupMenuOrtu`, `menuGroups` Admin, `menuGroupsTas`) — sidebar desktop, bottom nav, dan kisi menu
  memakai daftar yang sama. Keadaan akun (jabatan, wali kelas, buku terlambat) dari
  `src/lib/menu-konteks.ts` (`konteksMenuGuru/Siswa/Tas`, `cache()`-d) supaya layout & halaman menu
  tidak pernah beda isi.
- **Portal di luar /dashboard** (Pusat Perpustakaan, Perpustakaan Digital, Pusat Ujian, peserta ujian):
  `NavPortal` memakai pola yang sama — menu pertama jadi tombol tengah, empat berikutnya jadi tab,
  dan SELURUH menu tampil di beranda portal lewat `KisiMenuPortal`. Daftar menunya di
  `src/lib/menu-portal.ts` (dipakai bar tab, bottom nav, dan kisi).
- Top bar mobile TETAP ADA (logo + lonceng + `MenuAkunMobile`) — `MenuAkunMobile` masih memakai
  `BottomSheet` (Profil, Kartu Identitas, Pencarian Cepat, Keluar); yang dihapus hanyalah sheet BERISI
  DAFTAR MENU di bottom nav.
- `<main>` tetap `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0` (bar tetap setinggi 4rem).
- **Menu portal di layar lebar = kotak segmen putih** (tidak berubah): `flex w-fit gap-1 rounded-xl
  border border-gray-100 bg-white p-1`, item aktif `bg-primary-900 text-white`.
- **Satu pintu notifikasi** (15 Sep 2026): `KotakNotifikasiTombol` dengan `tindakan={[...]}`; jangan
  memasang lonceng terpisah berdampingan.
- **Tombol WhatsApp** hanya di situs publik.
- **Halaman di dalam `PortalShell` memakai `PageHeader`** dengan wrapper `p-6 lg:p-8 pt-16 lg:pt-8`. **Header itu NAVY seperti
  halaman lain dan pita menu tab portal berada DI BAWAHNYA** (keputusan user 21 Sep 2026, membalik aturan "header terang di portal"
  18 Sep): kepala portal (menempel) → `PageHeader` (menempel di bawahnya) → `PitaPortal` (menempel di bawah header). `PortalShell`
  menerima `menu` (daftar item, bukan elemen) dan memasang `PitaPortalProvider`; `PageHeader` merender `<PitaPortal />` sendiri, jadi
  halaman portal tidak perlu diubah. Halaman portal TANPA PageHeader memasang `<PitaPortal mandiri />` di paling atas. Judul beranda
  portal jangan mengulang nama portal (Pusat Ujian Online → "Daftar Ujian").

### 3.7 Pengelompokan menu = alur kerja (keputusan user 15 Sep 2026)
Menu yang dipakai berurutan berada dalam satu grup; nama menu tidak berubah. Urutan grup Admin: Dashboard → **Data Siswa & Guru**
(SPMB, Siswa, Kelas, Jurusan, Guru, Jabatan, Tahun Ajaran) → **Kurikulum & Pembelajaran** (Kalender Pendidikan, Jam, Mapel, Penugasan,
Jadwal, Pemeriksa Jadwal, RPP, Jurnal Guru, CBT, DKN) → **Kehadiran Siswa** → **Kesiswaan & BK** (Poin, Tata Tertib, Rekam BK, Peringatan
Dini, Ekstrakurikuler, Absen Ekstra, UKS, Bantuan & Beasiswa) → **Kepegawaian & Kinerja** → **PKL & Alumni** → **TU — Buku Induk & Data** →
**TU — Persuratan** → **TU — Layanan & Dokumen** → **Sarana & Perpustakaan** → **Keuangan** → **Website & Informasi** → **Sistem & Akun**.
TAS memakai nama grup yang sama (disaring jabatan). Guru: Dashboard Jabatan → **Mengajar** → **Wali Kelas & Siswa** → **Kesiswaan & BK** →
**Kinerja & Piket** → **PKL & Alumni** → **Sarana & Perpustakaan** → Tata Usaha → Akun Saya. Siswa: Akademik → **Kehadiran & Kedisiplinan** →
Perpustakaan → Akun Saya. Menu baru masuk ke grup yang sesuai alurnya; slot bottom nav dibangun dari nama grup yang sama (ubah bersamaan).

---

## 4. Tombol

Utility class di `@layer components` (`globals.css`) — pakai ini, jangan racik style tombol
manual dari nol:

| Class | Warna | Konteks |
|---|---|---|
| `.btn-primary` | navy `primary-700`→`primary-900` hover | Aksi utama umum (situs publik & beberapa CTA) |
| `.btn-gold` | gold solid | Aksi utama premium (CTA publik) |
| `.btn-gold-shimmer` | gold dengan animasi shimmer sapuan | CTA hero/unggulan |
| `.btn-outline` | border putih transparan | Aksi sekunder di atas background gelap |
| `.btn-modal-save` | navy `primary-700` padat → `primary-900` hover | **Aksi utama portal**: Tambah / Simpan / Buat / Kirim / Unggah (juga footer `Modal`) |
| `.btn-modal-cancel` | putih, garis abu, teks abu tua | **Aksi kedua portal**: Batal / Cetak / Ekspor / Impor / Unduh Excel / tautan ke halaman terkait |
| `.btn-hapus` | merah `red-600` padat | Hapus / aksi berbahaya berteks (ikon hapus di baris tabel tetap pola §15.2) |
| `.btn-awas` | amber `#d97706` padat | **Tindakan besar yang sulit dibatalkan tetapi BUKAN menghapus** (27 Sep 2026): Naik Kelas seluruh sekolah, memproses kelulusan, menghapus data satu kegiatan ujian. Dibuat karena tiga kelas di atas tidak muat — navy membuatnya terlihat sebiasa "Simpan" padahal akibatnya menyentuh ribuan baris, sedangkan merah salah karena tidak menghapus apa pun. **Bukan untuk "Unduh Excel"/"Ekspor"** yang kebetulan pernah dibuat amber — itu aksi kedua (`.btn-modal-cancel`). |

Semua tombol: `border-radius` besar (`9999px` untuk CTA publik, `0.75rem` untuk tombol
modal/admin), `transition: all 0.3s` atau `0.15s` untuk yang kecil. Ikon di dalam tombol pakai
lucide-react, ukuran mengikuti konteks (lihat §9).

Tombol "Cetak" / link ke halaman print: **JANGAN PERNAH `target="_blank"`** kecuali 2
pengecualian sah (`bel-sekolah/player`, `persuratan/[id]/edit-word` — lihat gotcha #19). Semua
halaman cetak lain WAJIB navigasi tab yang sama + punya tombol "Kembali" (`ArrowLeft`) sendiri.

### 4.1 Standar tombol aksi portal — SATU gaya per jenis aksi (keputusan user 15 Sep 2026)
- Tiga kelas di atas berukuran SAMA: tinggi minimal 40px (44px di layar sentuh), padding `0.5rem 1rem`, sudut 12px, huruf 14px
  tebal 600, ikon lucide di dalamnya otomatis 16px (CSS), jarak ikon–teks 8px. **Jangan menambah** `text-sm`, `px-4`, `py-2.5`,
  `gap-2`, `flex items-center`, `rounded-xl` — sudah diurus kelasnya. Kelas tata letak (`w-full`, `flex-1`, `sm:ml-auto`, `shrink-0`) boleh.
- **Baris alat = kotak cari/saringan/tab + tombol aksi BERSANDING dalam satu baris** (permintaan user 15 Sep 2026) — kelas bersama di
  globals.css, bukan racikan utility per halaman:
  ```tsx
  <div className="baris-alat mb-5">            {/* bisa juga di dalam kartu: className="page-card p-4 mb-5 baris-alat" */}
    <div className="alat-cari"><Search className="absolute left-3.5 …" /><input className="input-field pl-10" … /></div>
    <div className="alat-saring"><Select … /></div>      {/* DatePicker/MonthPicker/Select/label centang */}
    <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">…tab…</div>
    <div className="alat-aksi"><button className="btn-modal-cancel"><Printer /> Cetak</button><button className="btn-modal-save"><Plus /> Tambah</button></div>
  </div>
  ```
  Perilaku: layar lebar satu baris (aksi rata kanan). **HP: kotak cari + tombol tetap sebaris** — tombol berikon tampil ikon saja (teks tetap
  dibaca pembaca layar); saringan/tab turun ke baris berikutnya; tombol ≥3 mengambil barisnya sendiri dan tetap berteks. Kolom berlabel
  (label di atas isian) pakai `baris-alat items-end`. Baris `flex justify-end` terpisah (§3.1) HANYA untuk halaman tanpa cari/saringan/tab.
  Kotak cari bersyarat (`data.length > 0 &&`) diletakkan DI DALAM baris alat supaya tombol Tambah tetap tampil saat data kosong.
- **Tombol ikon-saja hanya untuk KATA KERJA UMUM** (20 September 2026). `.alat-aksi` menyembunyikan teks tombol
  (`font-size: 0`) demi hemat ruang — jelas untuk Tambah, Cetak, Kembali, Simpan, Unduh, Ekspor. Tombol yang NAMANYA
  membawa arti sendiri ("Kalender Bulanan", "Lapor Kerusakan", "Denah Ruang Ujian", "Pinjamkan Buku") jadi tidak bisa
  ditemukan karena ikonnya terbaca sebagai aksi umum — beri **`.btn-teks`** pada tombol itu, atau `.alat-teks` pada
  wadahnya bila semua tombolnya wajib berteks. Temuan user: "rekap absensi perkalender kok hilang?" — tombolnya ada,
  teksnya yang disembunyikan.
- **Tombol Kembali** (`ArrowLeft`) = `btn-modal-cancel`; **`PrintButton`** (Cetak / Simpan PDF) = `btn-modal-cancel` — disapu 63 tombol
  Kembali bergaya "hantu" abu-abu & 21 tombol racikan bergaris (15 Sep 2026). Pengecualian: tombol kembali di kepala navy `PortalShell`.
- `.btn-gold` HANYA untuk situs publik (CTA emas berbentuk pil). Di portal sudah disapu: 83 `btn-gold` → `btn-modal-save`, 29+ tombol
  racikan (emas, hijau "Unduh Excel", biru muda "Cetak") → kelas standar.
- Tombol di kepala `GroupedSection` (mis. "Cetak Kelas") memakai `btn-modal-cancel px-3 text-xs` — kepala grup kini terang.

---

### 4.2 Tombol "Kembali" — wajib di halaman DI LUAR menu (keputusan user 24 September 2026)

Permintaan user: "cek halaman yang tidak punya tombol kembali, buat sama semua". Aturannya:

- **Halaman yang ADA di menu sidebar/portal TIDAK diberi tombol Kembali** — menunya sendiri sudah jadi jalan
  pulang, dan tombol Kembali di sana ambigu tujuannya.
- **Halaman yang TIDAK ada di menu WAJIB punya tombol Kembali**: halaman anak (dibuka dari kartu/tautan halaman
  lain), halaman cetak, dan halaman yang dibuka dari lonceng notifikasi atau pindai QR.
- Bentuknya SATU untuk semua: `<BarisKembali href="..." />`
  (`src/components/shared/TombolKembali.tsx`) — `btn-modal-cancel` + panah kiri + kata "Kembali", pada baris
  sendiri tepat di bawah `<PageHeader />`. Tanpa `href` tombol memakai riwayat browser (dipakai bila asal
  halaman bisa berbeda-beda, mis. detail aset yang dibuka dari QR label).
- Komponen "Manager" yang dipakai DUA portal menerima `kembaliHref?: string`; portal yang halamannya ada di menu
  tidak mengirimnya, portal yang tidak mengirimkannya. Jangan meracik tombol kembali sendiri lagi.
- Periksa sebelum build: **`node scripts/cek-tombol-kembali.mjs`** (membandingkan seluruh `page.tsx` dengan
  daftar href di sidebar & `menu-portal.ts`). Sapuan pertama 24 Sep 2026 menambal 17 halaman.

## 5. Tabel & Data Display

### 5.1 Tabel data
`.data-table` (utility class siap pakai): header TERANG di layar (latar `#f5f6fa`, teks navy 62% — §5.7; saat CETAK tetap gradient navy `linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)`, teks putih 70%), uppercase, `letter-spacing: 0.06em`,
`font-size: 0.7rem` (di LAYAR 0.75rem = 12px sejak Pola v2, di HP padding sel lebih rapat; nilai CETAK tidak berubah); body `text-sm`, hover row `#f8f9fc`, border antar baris `#f1f3f7`, sudut
membulat di `th:first-child`/`th:last-child` saja (bukan `border-radius` tabel keseluruhan).
```tsx
<table className="data-table">
  <thead><tr><th>Kolom</th></tr></thead>
  <tbody><tr><td>Isi</td></tr></tbody>
</table>
```
Untuk tabel lebar (Buku Induk, dll) yang butuh scroll horizontal terlihat, bungkus dengan
`.scrollbar-visible` (bukan `.scrollbar-hide` default situs) supaya user tahu ada konten
tersembunyi di samping.

### 5.2 Tabel dikelompokkan → `GroupedSection`
Pola standar untuk tabel yang dipecah per grup (per kelas, per jurusan, dll):
```tsx
<GroupedSection title="X TKJ 1" subtitle="Wali: Budi" count={32} icon={Users}>
  <table className="data-table">...</table>
</GroupedSection>
```
`variant="warning"` (kepala amber lembut + chip ikon amber) khusus untuk grup yang perlu
perhatian, mis. "Belum Ada Kelas" / "Belum Absen". `headerActions` untuk tombol kecil di header
grup (mis. "Cetak Kelas Ini") — TETAP ikuti aturan §3.2 kalau ini di level halaman (bukan di
dalam grup), tapi di dalam `GroupedSection` per-grup memang disediakan slot resminya sendiri.

### 5.3 Kartu ringkasan angka → `StatTile`
```tsx
<StatTile value={128} label="Total Siswa" icon={Users} color="primary" />
```
`size="sm"` kalau `value` berpotensi teks panjang (bukan angka pendek) — supaya tidak
memaksa tinggi kartu tetangga di grid yang sama.
**Grid kartu angka WAJIB `.kisi-kartu`** (+ `kisi-kartu-3` … `kisi-kartu-7` sesuai jumlah kartu, tanpa pengubah = 2 kolom): SELALU 2 kolom
di HP (kartu ganjil terakhir melebar penuh), kolom bertambah di layar lebar. Jangan racik `grid grid-cols-1 sm:grid-cols-3` lagi — temuan user
15 Sep 2026: kartu 1 kolom memanjang (Presensi Pegawai), 3 kolom sempit (PKL), 2 kolom di halaman lain. 50 grid + kartu angka racikan
(Legalisir, Bantuan Siswa, Kenaikan Kelas, Poin siswa & orang tua) sudah dipindah.
Sejak 15 Sep 2026 tampilan bawaannya **berwarna lembut** (§17.2); dari halaman SERVER kirim `ikon="nama"`, bukan
`icon={<X />}` (CLAUDE.md #35).

### 5.4 Kondisi kosong → `EmptyState`
```tsx
<EmptyState icon={Inbox} title="Belum ada data" description="..." />
```
Selalu pakai ini untuk state "tidak ada data" di tabel/list mana pun — jangan tulis pesan kosong
custom per halaman.

### 5.5 Badge & status
```css
.badge          /* pill kecil generik, uppercase, letter-spacing 0.06em */
.badge-gold     /* bg gold 15% alpha, teks #B87D0E, border gold 30% alpha */
.badge-navy     /* bg navy 10% alpha, teks primary-700, border navy 15% alpha */
.status-badge   /* pill dengan border (border-width:1px) + .status-dot bulat kecil di sampingnya */
```
Untuk status semantik (HADIR/IZIN/SAKIT/ALPHA, PENDING/APPROVED/REJECTED, dll), pakai pola
`bg-{color}-50 text-{color}-700 border-{color}-200` per §2, BUKAN `.badge-gold`/`.badge-navy`
(itu khusus aksen dekoratif/kategori, bukan status).

### 5.6 Pagination
**Komponen bersama (sejak 14 September 2026, permintaan user): `usePaginasi` + `<Paginasi>`.**
Mayoritas tabel memakai strategi "load semua + filter/cari di client"; daftar yang bisa panjang
(akun pengguna, siswa, orang tua, surat, buku, pinjaman) WAJIB dipotong per halaman supaya layar
tidak berisi ribuan baris. Jangan racik tombol Sebelumnya/Berikutnya sendiri lagi:
```tsx
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

const tersaring = data.filter(/* cari & saringan */);
const hal = usePaginasi(tersaring, 50, `${cari}|${saringan}`); // kunci berubah → kembali ke halaman 1

<tbody>{hal.potongan.map((row, i) => <tr key={row.id}><td>{hal.awal + i}</td>…</tr>)}</tbody>
<Paginasi hal={hal} satuan="siswa" className="border-t border-gray-100" />
```
- Ukuran halaman: 50 untuk tabel admin, 25 untuk tabel perpustakaan, 24 untuk kartu/grid (habis dibagi 2/3/4 kolom).
- `<Paginasi>` tidak tampil kalau hanya satu halaman; di HP nomor halaman disembunyikan (cukup Sebelumnya/Berikutnya).
- Untuk grid/kartu panjang beri `idGulir` (+ `scroll-mt-*` di elemen tujuan) supaya layar kembali ke awal daftar.
- Dataset yang benar-benar besar & tumbuh tanpa batas (contoh: **Log Aktivitas**,
  `src/components/admin/LogAktivitasClient.tsx`) tetap dipaginasi di SERVER: kirim `total` + `skip`/`take` dari
  Prisma — memotong di klien dari data yang sudah diambil penuh percuma untuk data sebesar itu.

### 5.7 Kepala tabel terang & FREEZE (15 Sep 2026)
- **Kepala `.data-table` di layar terang** seperti panel dashboard (latar `#f5f6fa`, teks navy 62%, garis bawah tipis) — CETAK tetap navy.
  Tabel racikan sebaiknya dipindah ke `.data-table` (contoh: UKS).
- **Freeze otomatis di SEMUA tabel layar** lewat `PembekuTabel` (dipasang sekali di `Providers`): judul tabel menempel saat digulir ke bawah
  (wadah tabel dibatasi setinggi layar), kolom pertama — dan kolom kedua bila kolom pertama "No"/"#"/kotak centang — menempel saat digeser
  ke samping (hanya bila tabel lebih lebar dari wadahnya dan kolom beku ≤ 55% lebar). Syarat: tabel punya `<thead>` dan dibungkus wadah
  `overflow-x-auto`/`overflow-auto` (maks 3 tingkat di atasnya) — **setiap tabel layar baru WAJIB dibungkus wadah itu**. Dilewati:
  `.print-doc`/`.a4-page`, tabel yang sudah memakai `sticky` sendiri (Buku Induk, jadwal), dan `data-beku="tidak"`.
- **Sapuan 15 Sep 2026 (malam):** 36 tabel racikan berkepala gradien tipis → `.data-table`; 15 tab/segmen aktif putih-bayangan & emas →
  **navy padat** (`bg-primary-900 text-white`) — satu gaya tab aktif untuk semua portal; 207 kartu racikan
  `bg-white rounded-2xl border border-gray-100 shadow-sm` → `.panel`. Kartu/tab/tabel baru langsung pakai pola ini.
- **Audit sisa 15 Sep 2026 (build 13):** kepala kartu navy racikan (16) → kepala terang `border-b border-gray-100 bg-white`, kepala hari
  jadwal → `bg-[#f5f6fa]`; 9 tabel racikan → `.data-table`; kalender absensi bulanan → kepala terang + freeze sendiri (judul & kolom nama);
  semua pil status `text-[0.7rem]` → `text-xs`; teks "Memuat..." polos → `Loader2`; kartu filter Pendaftaran berwarna lembut.
  **Pengecualian yang SENGAJA tetap khusus** (jangan "diseragamkan"): layar ujian siswa `/ujian-online` & Buku Tamu publik (gaya bersih
  sendiri), layar kiosk/QR/pindai berlatar gelap, editor Word, popup DatePicker/MonthPicker, kalkulator & kertas coretan ujian, matriks
  bersticky (jadwal non-blok, Buku Induk, Nominatif, Pembagian Mengajar), dan `<select>` di lembar jawaban menjodohkan (`SoalTampil` —
  pemilih bawaan HP paling andal saat ujian).

### 5.8 Kisi menu ala aplikasi bank → `MenuLengkap` (18 September 2026)
Permintaan user dengan contoh Livin' & BRImo: fitur dikumpulkan sebagai kisi ikon berwarna, bukan
daftar teks di laci.
```tsx
<MenuSiswa ringkas={12} hrefSemua="/dashboard/student/menu" judul="Menu Cepat" {...konteksMenu} />  // dashboard
<MenuGuru {...konteksMenu} />                                                                        // halaman /menu
```
- `ringkas={n}` → n−1 menu terpakai + kartu "Lihat Semua"; tanpa `ringkas` → kotak **Cari menu** +
  semua grup berjudul.
- `pintasan` = pita navy bergradien berisi maksimal 4 aksi utama portal (padanan baris
  Transfer/BRIVA/E-Wallet/Pulsa di BRImo) — isinya sama dengan 4 tautan bottom navbar.
- Ikon memakai **delapan gradasi bergilir** (biru, hijau, kuning, ungu, merah muda, toska, nila, navy)
  — warna per menu ditentukan URUTAN supaya selalu konsisten. Warna dasar aplikasi tetap navy.
- Kelas bersama di `globals.css`: `.kartu-menu` (+ `.ikon-menu`), `.pita-pintasan`/`.pintasan-item`,
  animasi masuk `.kisi-menu > *`. Menekan kartu = mengecil 6% (`:active`), dimatikan saat
  `prefers-reduced-motion: reduce`. Jangan meracik kartu menu sendiri di luar komponen ini.

---

## 6. Form & Input

### 6.1 Input teks/textarea/number
Class `.input-field` — border abu `#e5e7eb`, `border-radius: 0.75rem`, padding `0.625rem
0.75rem`, `text-sm`; fokus → border `primary-500` + ring biru lembut 3px; disabled → bg
`#f9fafb`, teks `#9ca3af`.
```tsx
<label className="label-field">Nama</label>
<input className="input-field" ... />
```

### 6.2 Dropdown/select
**JANGAN PERNAH `<select>` native.** Pakai `<Select>` (`src/components/admin/Select.tsx`):
```tsx
<Select value={value} onChange={setValue} options={[{value:"a",label:"A"}]} placeholder="Pilih..." />
```
Otomatis jadi searchable (input cari muncul) kalau `options.length > 8`
(`SEARCHABLE_THRESHOLD`). Mendukung navigasi keyboard (↑↓ Enter Esc), auto flip ke atas
(`openUpward`) kalau ruang di bawah tidak cukup, opsi terpilih ditandai `primary-50` bg +
`Check` icon.

### 6.3 Tanggal & bulan
**JANGAN PERNAH `<input type="date">`/`<input type="month">` native** (tampilan beda-beda tiap
OS/browser, gotcha #23). Pakai:
```tsx
<DatePicker value={value} onChange={setValue} />   {/* format "YYYY-MM-DD" */}
<MonthPicker value={value} onChange={setValue} />  {/* format "YYYY-MM" */}
```
Jam: `<TimePicker value={jam} onChange={setJam} />` (format `"HH:MM"` 24 jam, `ringkas` untuk sel tabel) —
**JANGAN `<input type="time">`** (tampil AM/PM di perangkat berbahasa Inggris; CLAUDE.md #70).
Keduanya custom popup kalender, `onChange` menerima string langsung (bukan event). Form yang
sudah pakai komponen `Field` dari `BukuIndukField.tsx` otomatis render `DatePicker` untuk
`type="date"` — tidak perlu diubah manual.

### 6.4 Error & pesan
`.error-msg` — bg merah muda `#fef2f2`, border `#fecaca`, teks `#dc2626`, `text-sm`,
`border-radius: 0.75rem`. Pakai untuk error validasi form inline (bukan `Alert` — `Alert`
untuk notice level-halaman, `.error-msg` untuk error field/form spesifik).

### 6.5 Notifikasi transient & konfirmasi
- **Toast** (`useToast()` dari `ToastProvider`) — notifikasi sekilas (`success | error | warning
  | info`), dipanggil `toast.success("Tersimpan")` dsb. Pakai untuk feedback aksi (simpan,
  hapus, dll), BUKAN untuk error validasi form (pakai `.error-msg` inline untuk itu).
- **Confirm** (`useConfirm()` dari `ConfirmProvider`) — dialog konfirmasi async
  (`await confirm({...})`), pakai untuk aksi destruktif (hapus data, dll) — JANGAN `window.confirm()` browser native.

### 6.6 Default status kosong (WAJIB)
Semua dropdown status kehadiran/kondisi (Absensi, Absensi Kelas, Buku Piket, Kehadiran Guru
Piket, Jurnal Mengajar, dan modul baru serupa) WAJIB default **KOSONG** (`""`), bukan
`"HADIR"`/nilai lain — baik di state awal React maupun fallback API (`?? ""`). Validasi wajib
sebelum simpan: tolak/skip record yang statusnya masih kosong. (Keputusan eksplisit user
2026-08-08 setelah insiden nyata: default lama diam-diam bikin siswa/guru yang belum dicek
kelihatan "Hadir".)

---

## 7. Modal

`Modal` (`src/components/admin/Modal.tsx`) — patokan TUNGGAL untuk semua dialog:
```tsx
<Modal open={open} onClose={close} title="Judul" size="md" footer={<>...</>}>
  {children}
</Modal>
```
- `size`: `sm` (max-w-sm) / `md` (max-w-md, default) / `lg` (max-w-xl) / `xl` (max-w-3xl).
- Header selalu gradient navy 3-stop (sama §2) + watermark pattern, judul `font-heading
  font-semibold` putih, `description` opsional teks putih 50% di bawahnya.
- `headerActions` — slot tombol kecil di header sebelum tombol close (X).
- `footer` — area tombol aksi (biasanya `.btn-modal-cancel` + `.btn-modal-save`), border-top.
- `scrollBody={true}` kalau isi panjang (form Buku Induk dll) — body jadi `max-h-[90vh]
  overflow-y-auto` terpisah dari header/footer yang tetap fixed.
- Tutup via klik backdrop ATAU tombol X ATAU tombol `Escape` (semua sudah built-in).
- Sengaja TIDAK `overflow-hidden` di card luar (supaya dropdown `Select` di dalam body tidak
  terpotong) — sudut rounded dijaga manual di header/body/footer masing-masing.

---

## 8. Ikon

Library: **lucide-react** secara eksklusif untuk ikon fungsional UI (Material Symbols Outlined
hanya untuk kasus khusus tertentu, bukan default). Ukuran umum yang dipakai konsisten di kode
nyata:

| `size` | Konteks |
|---|---|
| `14`–`15` | Ikon kecil dalam badge/label grup (`GroupedSection` icon) |
| `16`–`18` | Ikon dalam tombol, input (chevron dropdown, search icon), `Alert` icon |
| `20`–`22` | Ikon `PageHeader`, ikon aksi header (X modal) |
| `40` | Ikon besar `EmptyState` |
| `56` | Ikon watermark besar transparan di pojok `StatTile` |

---

## 9. Animasi & Interaksi

Semua keyframe terdaftar di `globals.css`, hormati `@media (prefers-reduced-motion: reduce)` —
jangan tambah animasi baru yang mengabaikan preferensi ini. Animasi siap pakai yang sudah ada
(pakai ulang, jangan duplikat definisi keyframe):

| Class/keyframe | Dipakai untuk |
|---|---|
| `diagonalDrift` (otomatis di `body`) | Tekstur garis diagonal dekoratif background situs |
| `.modal-panel-in` / `.modal-backdrop-in` | Animasi masuk `Modal` (0.18s/0.22s) |
| `.card-fade-up` | Animasi masuk kartu di `PageHeader`/dashboard |
| `.rank-pulse`, `.bounce-in`, `.wiggle-loop`, `.spin-slow`, `.podium-glow`, `.confetti-piece` | Elemen gamifikasi (leaderboard, ranking siswa) |
| `.live-dot` (`pulseLive`) | Indikator "online"/live (mis. status Jaringan Sekolah) |
| `.num-flash` | Highlight angka yang baru berubah |

**Scrollbar**: default situs **selalu** hilangkan scrollbar visual (`.scrollbar-hide` — bahkan
diterapkan global di `html`/`*` via `-ms-overflow-style`/`::-webkit-scrollbar{display:none}`)
tapi tetap scrollable. Kecualikan dengan `.scrollbar-visible` (tabel lebar, warna
`primary-300`/`primary-50`) atau `.sidebar-scroll` (dalam sidebar gelap, thumb putih
transparan) HANYA kalau user memang perlu tahu ada overflow tersembunyi.

---

## 10. Sistem Cetak (Print)

### 10.1 Aturan wajib tiap halaman cetak baru
1. Wrapper terluar pakai class `.print-doc` (memaksa font Arial Narrow di seluruh isi cetak)
   **DITAMBAH `bg-white` eksplisit** — `.print-doc`/`.a4-page` TIDAK otomatis kasih background
   putih, tanpa ini abu-abu dashboard (`#f0f2f7`) tembus di preview layar:
   ```tsx
   <div className="print-doc bg-white ...">
   ```
   (Kecuali sudah pakai `SheetShell`/`.a4-page` yang sudah punya `bg-white` bawaan sendiri.)
2. Set `@page` sendiri per halaman via `<style>{...}</style>` inline — **JANGAN ubah** nilai
   `@page` milik halaman cetak LAIN yang sudah ada tanpa diminta eksplisit. Nilai nyata yang
   sudah dipakai (referensi ukuran margin per jenis dokumen):
   | Jenis dokumen | `size` | `margin` |
   |---|---|---|
   | Jurnal mengajar, Buku Mutasi | A4 landscape | `1.2cm`–`1.5cm` |
   | Jadwal (blok/non-blok, per kelas/keseluruhan) | A4 portrait/landscape | `8mm 2cm` |
   | Kelas (cetak data kelas) | A4 landscape | `1cm` |
   | Buku Induk siswa (per-siswa & per-kelas) | A4 | `0` (kop full-bleed sampai tepi kertas) |
   | Kalender absensi bulanan | A4 landscape | `2cm` |
   | Beban mengajar (TeachingLoadPrintSheet) | A4 landscape | `6mm` |
   | Kartu Tanda, Barcode, DKN | A4 | `1cm` |
   | Absensi jurnal per kelas | A4 (portrait/landscape dinamis) | dinamis (`pageMarginCss`, dipilih user) |

   Kalau halaman baru mirip salah satu di atas, contek nilainya; kalau benar-benar baru, pilih
   margin sesuai kepadatan konten (tabel lebar → landscape + margin sempit `8mm–1cm`; dokumen
   resmi/kop surat → margin lebih lebar `1.2cm–2cm`).
3. **JANGAN hapus** blok global `@media print { body { background: white !important;
   background-image: none !important; animation: none !important; } }` di `globals.css` —
   tanpa ini, tekstur diagonal dekoratif body ikut tercetak di ruang kosong halaman terakhir.
4. Tombol "Cetak"/link ke halaman print: navigasi tab yang **sama** (bukan `target="_blank"`) +
   sediakan tombol "Kembali" (`ArrowLeft`) — lihat §4 & gotcha #19.
5. Kop surat: pakai `<PrintKop title="..." subtitle="..." logoUrl={...} />`
   (`src/components/shared/PrintKop.tsx`) untuk letterhead konsisten, bukan racik header cetak
   manual per halaman.
6. Tombol cetak: pakai `<PrintButton />` (`src/components/shared/PrintButton.tsx`,
   `window.print()`, "use client" terpisah karena server component tidak bisa akses `window`).

### 10.2 `.a4-page` / `.a4-page-body` (opsional, untuk WYSIWYG preview yang presisi fisik)
`width: 210mm; min-height: 297mm;` + watermark `::before` (`/images/pattern-smk.png`, tile
90px, opacity 0.04) + `.a4-page-body` padding `2cm`. Saat print, `box-shadow`/`margin`/`width`
di-reset (`!important`) supaya tidak dobel dengan `@page`. Pakai pola ini untuk halaman yang
juga berfungsi sebagai preview WYSIWYG di layar (bukan cuma cetak langsung).

---

## 11. Pola Pengambilan Data

### 11.1 Server Component (default untuk halaman baca-data)
```tsx
export const dynamic = "force-dynamic"; // WAJIB — lihat CLAUDE.md gotcha #1
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export default async function Page() {
  const session = await verifyRole(["ADMIN"]);
  const data = await prisma.xxx.findMany(...).catch(() => []); // WAJIB .catch() kalau dipakai komponen luas (Footer, dsb) — gotcha #1
  return ...;
}
```
`export const dynamic = "force-dynamic"` WAJIB di setiap server component yang panggil Prisma
LANGSUNG maupun TIDAK LANGSUNG (lewat child component seperti `<Footer/>`). `.catch(() =>
fallback)` WAJIB di query dari komponen yang dipakai banyak halaman publik (build Next.js bisa
gagal total kalau tidak — lihat CLAUDE.md gotcha #1, sudah pernah kejadian nyata).

### 11.2 Client Component
```tsx
"use client";
useEffect(() => {
  fetch("/api/admin/xxx")
    .then(r => r.json())
    .then(data => setData(data))
    .catch(() => {})       // WAJIB — tanpa ini spinner macet permanen kalau request gagal (gotcha #12)
    .finally(() => setLoading(false));
}, []);
```
Client component TIDAK BOLEH import `prisma`/`dal.ts` langsung (`server-only`) — selalu lewat
API route yang sudah `verifyRole`.

### 11.3 API Route
```ts
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER"]);
  // untuk endpoint /api/teacher/**: WAJIB scope ke data yang benar-benar berhak diakses guru
  // itu (homeroomOf / teachingLoad) — JANGAN percaya classId/studentId dari client mentah-mentah
  // (celah IDOR, pernah kejadian nyata — gotcha #10).
}
```

### 11.4 Duplikasi Grade/Attendance
Kedua model ini TIDAK punya unique constraint DB — cegah duplikat dengan transaction
delete-then-create (lihat CLAUDE.md, jangan `createMany({skipDuplicates:true})`, tidak akan
bekerja tanpa constraint).

### 11.5 Export data → Excel (.xlsx)
**Tidak ada ekspor CSV baru.** Pakai `balasanExcel()` / `balasanExcelBanyakSheet()` dari
`src/lib/ekspor-excel.ts` — lihat pola lengkap & alasannya di CLAUDE.md bagian "Export data →
Excel". Ringkasnya: CSV koma bikin Excel Indonesia menumpuk semua data di satu kolom; .xlsx
tidak. Angka dikirim sebagai `number` (bukan string) supaya bisa langsung dihitung di Excel.

---

## 12. Guard & Akses

Pola standar untuk modul yang dibatasi jabatan tertentu (bukan role polos ADMIN/TEACHER/STUDENT):
```ts
// src/lib/<nama>-guard.ts
export async function assertXxx(session) {
  if (session.role === "TEACHER") await assertJabatan(session, ["Nama Jabatan Persis"]);
  // ADMIN & TAS otomatis lolos karena tidak masuk cabang if
}
```
Lihat contoh nyata: `branding-guard.ts`, `uks-guard.ts`, `kedisiplinan-guard.ts`,
`jaringan-guard.ts`, `humas-guard.ts`. Reuse pola ini untuk jabatan baru — jangan tulis
pengecekan jabatan inline berulang di tiap route.

---

## 13. Reuse Lintas Portal (komponen "Manager")

Kalau satu fitur admin (Berita, Galeri, Banner, PKL, dll) juga perlu diakses guru dengan
jabatan tertentu: **JANGAN duplikasi halaman.** Ekstrak isi ke
`src/components/shared/<Nama>Manager.tsx`, lalu buat wrapper tipis di tiap portal:
```tsx
// src/app/dashboard/admin/x/page.tsx  DAN  src/app/dashboard/teacher/x/page.tsx
export default function Page() { return <XManager />; }
```
Untuk variasi scope (mis. wali kelas vs admin), pakai props seperti `classesEndpoint`,
`isAdmin`, `mode` — bukan cabang `if` besar di dalam satu file monolitik. Lihat
`NewsManager`/`GalleryManager`/`BannerManager`/`AbsensiSiswaManager`/`PklRegistrationReview`
sebagai referensi.

---

## 14. Checklist Halaman/Fitur Baru

Sebelum menganggap halaman baru "selesai", cek semua ini:

- [ ] `export const dynamic = "force-dynamic"` kalau server component pakai Prisma (langsung/tidak langsung)
- [ ] Query Prisma di komponen yang dipakai luas → `.catch(() => fallback)`
- [ ] `params`/`searchParams` di-`await` (Promise di Next.js 16)
- [ ] Wrapper halaman: `<div className="p-6 lg:p-8 pt-16 lg:pt-8">` + `<PageHeader .../>` tanpa prop actions
- [ ] Tombol aksi header di baris `<div className="flex justify-end mb-5">` terpisah di bawah `PageHeader`, bukan di dalamnya, dan bukan dibungkus div `print:hidden` sendirian
- [ ] Dropdown pakai `<Select>`, bukan `<select>` native
- [ ] Tanggal/bulan pakai `<DatePicker>`/`<MonthPicker>`, bukan `<input type="date/month">` native
- [ ] Tabel pakai `.data-table` (+ `GroupedSection` kalau berkelompok), state kosong pakai `EmptyState`
- [ ] Kartu angka ringkasan pakai `StatTile` dengan salah satu dari 7 warna baku
- [ ] Modal pakai komponen `Modal`, bukan dialog custom
- [ ] Notifikasi aksi pakai `useToast()`, konfirmasi destruktif pakai `useConfirm()` (bukan `window.confirm`)
- [ ] Warna primary TIDAK PERNAH pakai `primary-800` (tidak ada)
- [ ] Status semantik (kehadiran, approval, dll) pakai pasangan `bg-{c}-50 text-{c}-700 border-{c}-200`, dropdown status default KOSONG (`""`) bukan nilai tertentu
- [ ] Fetch client-side selalu `.then().catch().finally()` lengkap
- [ ] Endpoint `/api/teacher/**` yang terima `classId`/`studentId` dari client → validasi scope akses guru di server, jangan percaya begitu saja
- [ ] Jabatan-gated module → pola `assertXxx` di `lib/<nama>-guard.ts`, bukan inline
- [ ] Fitur yang perlu dipakai admin + guru sekaligus → komponen `shared/<Nama>Manager.tsx` + wrapper tipis per portal
- [ ] ID unik di client component yang di-SSR → `useId()`, bukan `Math.random()`/`crypto.randomUUID()` di body komponen
- [ ] Sidebar baru (kalau ada menu baru) → masuk grup yang sesuai, ikuti pola accordion+sticky
- [ ] Halaman cetak baru → `.print-doc bg-white`, `@page` sendiri (lihat tabel §10.1), tombol Cetak tab yang sama + tombol Kembali, `<PrintKop>`/`<PrintButton>`, JANGAN sentuh `@page`/body-background rule milik halaman lain
- [ ] Daftar jurusan di halaman publik mana pun → query live `prisma.major.findMany()`, jangan hardcode
- [ ] Tombol unduh data → endpoint `.xlsx` lewat `balasanExcel()`, bukan CSV rakitan sendiri
- [ ] `npx tsc --noEmit` bersih sebelum dianggap selesai

---

## 15. Pola Tambahan (Loading, Aksi Baris Tabel, Search, Upload, Z-Index)

### 15.1 Loading state
Full-page/section loading (dipakai 200+ tempat) — SELALU `Loader2` (lucide-react) + `animate-spin`,
JANGAN bikin spinner custom:
```tsx
// Loading penuh halaman (dalam wrapper p-6 lg:p-8 yang sama spt halaman jadi)
<div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400">
  <Loader2 size={24} className="animate-spin" />
</div>
// Loading inline dengan teks (mis. di dalam page-card)
<Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
```

### 15.2 Tombol aksi baris tabel (Edit/Hapus ikon-saja)
Pola standar tombol ikon-saja di baris tabel — Edit pakai warna primary, Hapus pakai warna merah,
SELALU ada `title` untuk aksesibilitas:
```tsx
<button onClick={() => onEdit(row)} title="Edit"
  className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
  <Edit2 size={14} />
</button>
<button onClick={() => onDelete(row.id)} title="Hapus"
  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
  <Trash2 size={14} />
</button>
```
Ukuran ikon `13`–`15` (paling umum `14`), `Pencil` dipakai bergantian dengan `Edit2` di beberapa
tempat (sama-sama sah, jangan campur keduanya dalam satu tabel yang sama).

### 15.3 Search input (filter client-side)
Ikon `Search` diposisikan absolute di dalam `.input-field` — dipakai di 30+ tabel yang pakai
strategi "load semua + cari di client" (§5.6):
```tsx
<div className="relative flex-1">
  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
  <input value={search} onChange={e => setSearch(e.target.value)}
    placeholder="Cari nama, NIS, atau NISN..."
    className="input-field pl-10" />
</div>
```
SATU gaya untuk SEMUA kotak cari (disapu 15 Sep 2026: 17 ikon & 6 isian): ikon `size={15}` di `left-3.5`, isian `input-field pl-10`
(tanpa `text-sm`). Di dalam baris alat, bungkusnya `.alat-cari` (§4.1) — `relative` sudah termasuk di kelas itu.
```tsx
```

### 15.4 Upload file/gambar
JANGAN racik `<input type="file">` + fetch upload manual dari nol — pakai komponen yang sudah
ada, semuanya submit ke `POST /api/upload` (gotcha #7 CLAUDE.md, hasil path relatif disimpan ke DB):
- `<ImageUpload>` (`src/components/admin/ImageUpload.tsx`) — gambar umum (banner, thumbnail, logo).
- `<AvatarUpload>` (`src/components/shared/AvatarUpload.tsx`) — foto profil bulat, ada tombol ganti overlay.
- `<FileUpload>` (`src/components/shared/FileUpload.tsx`) — dokumen non-gambar (PDF, dll — lampiran PKL, dsb).

### 15.5 Skala Z-Index
Dipakai bertingkat secara konsisten — kalau menambah elemen baru yang perlu melayang di atas
elemen lain, pilih dari skala ini (jangan asal angka acak):

| `z-*` | Dipakai untuk |
|---|---|
| `z-10` | Toolbar sticky sekunder di dalam satu halaman (mis. toolbar cetak di atas konten, bukan `PageHeader`) |
| `z-20` | Header tabel sticky / kolom beku (`sticky top-0`/`sticky left-0` di dalam kontainer scroll tabel lebar) |
| `z-30` | Header halaman level-atas yang sticky (`PageHeader`, header "hero" landing portal, toolbar navy custom di halaman cetak) |
| `z-40` | Spacer topbar mobile (`AdminTopBar`) |
| `z-50` | `Modal` backdrop, sidebar overlay mobile (kalau ada), tombol mengambang `fixed` (mis. toggle layar penuh leaderboard, `WhatsAppButton`), `MobileBottomNav` (bar navigasi bawah mobile — pengganti hamburger+drawer, lihat §3.6) |
| `z-[60]` | Popup dropdown `Select`, panel `BottomSheet` (dipicu `MobileBottomNav`) — keduanya harus di atas `Modal`/`MobileBottomNav` (`Select` sering dipakai di dalam form Modal MAUPUN di dalam BottomSheet) |
| `z-[70]` | Dialog **Konfirmasi** (`ConfirmProvider` → `Modal lapisanAtas`) — wajib di atas Modal mana pun, karena konfirmasi sering dipicu dari DALAM modal (jendela Tindakan papan pantau). Jangan beri modal biasa z di atas 50 |
| `z-[100]` | `ToastProvider` — paling atas, harus selalu terlihat di atas apapun termasuk `Modal` |

---

## 16. Referensi Silang

- `CLAUDE.md` — 24 gotcha teknis (auth/session, Prisma, build Docker, dll) — WAJIB dibaca bersama dokumen ini, saling melengkapi bukan duplikat.
- `AGENTS.md` — peringatan versi Next.js non-standar, cek `node_modules/next/dist/docs/` sebelum pakai API yang tidak yakin.

---

## 17. Pola Tampilan v2 — panel, kartu angka lembut, responsif (15 September 2026)

Permintaan user: dashboard & halaman login dirapikan — layout, jarak, ukuran huruf, bentuk, grafik, animasi —
modern dan responsif untuk semua perangkat, lalu diterapkan ke semua halaman. **Tahap 1 (sudah):** dashboard Admin/TAS,
Guru, Siswa, Orang Tua, Bendahara, dan halaman Masuk. Halaman lain menyusul memakai pola yang SAMA di bawah ini.

### 17.1 Token & kelas (globals.css, blok "POLA TAMPILAN v2")
| Nama | Isi / pemakaian |
|---|---|
| `shadow-panel`, `shadow-panel-naik` | Bayangan halus bawaan panel / saat disorot (utility Tailwind dari `@theme`) |
| `ease-halus` | `cubic-bezier(0.16, 1, 0.3, 1)` — satu kurva untuk semua gerak |
| `.panel` | Wadah isi: putih, sudut 16px, garis `rgb(15 26 69 / .07)`, `shadow-panel` |
| `.panel-kepala` / `.panel-judul` / `.panel-ikon` / `.panel-isi` / `.panel-tautan` | Kepala panel (judul 15px + chip ikon 32px + tautan "Lihat semua"), isi 16px (HP) / 20px (≥640px) |
| `.panel-interaktif` | Kartu yang bisa diklik: naik 2px + bayangan menebal saat disorot, garis fokus emas |
| `.masuk-halus` | Animasi masuk CSS murni (`@starting-style`, tanpa JavaScript) |
| `.bar-tumbuh` / `.bar-bagian` | Batang grafik ringkas tumbuh saat dibuka |
| `.angka` | `tabular-nums` — WAJIB untuk angka yang bersejajar (statistik, jam, tabel) |
| `.label-kecil` | Label seksi 12px huruf kapital |
| `.sentuh` | Tinggi minimal 44px di layar sentuh (`pointer: coarse`) |
Semua animasi dimatikan saat `prefers-reduced-motion: reduce`.

### 17.2 Komponen
- **`Panel`** (`src/components/shared/Panel.tsx`) — `judul`, `ikon`, `tautan={{label, href}}`, `keterangan`, `isi={false}` untuk
  daftar baris penuh (`divide-y`). `PanelKosong` = keadaan kosong RINGKAS di dalam panel (bukan `EmptyState` setinggi 16rem).
  `DaftarPengumuman` = pengumuman aktif satu gaya untuk semua portal.
- **`StatTile tampilan="lembut"`** — **BERWARNA LEMBUT (pilihan user 15 Sep 2026, patokan semua halaman):** latar gradasi
  warna muda + garis senada, chip ikon berwarna penuh (ikon putih), angka navy. **Susunan: chip ikon + angka SEBARIS, label selebar kartu di bawahnya** (permintaan user 15 Sep 2026 — label & angka tidak lagi dipotong "…"; angka menyesuaikan lebar kartu lewat container query). Tiap kartu dalam satu baris boleh warna
  sendiri (mis. Siswa biru, Guru hijau, Kelas ungu); kuning & merah dipakai untuk hal yang menunggu/bermasalah. `href` membuat
  kartu bisa diklik, `sorot` menandai perlu perhatian (cincin kuning + titik berdenyut). Dari halaman server pakai `ikon="nama"`.
  **Sejak 15 Sep 2026 `lembut` = BAWAAN `StatTile` di semua halaman.** `tampilan="gradien"` hanya untuk kartu yang ikut
  TERCETAK (rekap kehadiran di rapor Siswa & Orang Tua) supaya hasil cetak tidak berubah.
- **`DonatBagian`** — donat SVG komposisi (mis. siswa & guru L/P) dengan total di tengah dan keterangan angka + persen;
  dipakai berdampingan (`grid grid-cols-2`) di panel Komposisi dashboard Admin (pilihan user 15 Sep 2026). `BarDaftar` menerima
  `warna` per baris — batang per jurusan memakai `Major.themeColor`.
- **`BarDaftar` / `BagianBar`** (`src/components/shared/GrafikRingkas.tsx`) — grafik ringkas HTML+CSS tanpa pustaka:
  satu warna untuk besaran (per jurusan), warna berbeda hanya untuk bagian yang memang berbeda (L/P, status hadir).
  Angka selalu tertulis langsung. Recharts tetap untuk grafik deret waktu (mis. tren tagihan Bendahara).
- **`JadwalHariIni`** — garis waktu jadwal hari ini: yang berlangsung disorot + kemajuan jam, berikutnya ditandai,
  yang lewat diredupkan; diperbarui tiap 30 detik. **`JadwalMingguan`** — tab per hari (bawaan hari ini), menggantikan
  daftar enam hari yang memanjang.
- **`AgendaCalendar`** — kini panel standar; tanggal berisi agenda bisa DIKETUK di HP (dulu hanya hover).
- **Halaman Masuk** mengikuti pola halaman publik ringkas seperti Cek Kelulusan (permintaan user 15 Sep 2026: "bagian birunya
  tidak banyak"): `Navbar` situs → pita biru pendek (label, judul, keterangan, ayat) → satu kartu formulir putih `max-w-md`
  dengan `.label-field`/`.input-field` di latar krem. Tanpa panel biru setengah layar, statistik, atau animasi dekoratif.

### 17.3 Tata letak dashboard
- Urutan: header → pemberitahuan yang perlu tindakan (hanya bila ada) → kartu angka → isi.
- Isi desktop dua kolom tumpuk bebas (`xl:grid-cols-12`, kiri `xl:col-span-7/8` + kanan `xl:col-span-5/4`, masing-masing
  `space-y-6`, `items-start`) — panel tidak ikut ditarik setinggi tetangganya, tidak ada ruang kosong besar.
- Kartu angka: `grid-cols-2` di HP → 3/4/6 kolom di layar lebar; jarak `gap-3 sm:gap-4`; antar-seksi `space-y-6`.
- Tata letak DALAM panel memakai **container query** (`@container` + `@3xl:grid-cols-2`) — menyesuaikan lebar panelnya,
  bukan lebar layar, jadi tetap rapi di kolom sempit maupun lebar.
- Jangan menambah kartu/pita pengingat tugas di dashboard — sudah di lonceng (CLAUDE.md #31).

### 17.4 Aturan wajib
1. **Huruf minimal 12px** (`text-xs`) untuk teks yang dibaca; isi 14px (`text-sm`). `text-[10px]`/`text-[9px]` dilarang.
   Disapu 15 Sep 2026: 366 pemakaian di 101 berkas layar (cetak tidak disentuh). Pengecualian 11px: angka di lingkaran
   penghitung kecil (`min-w-[18px] h-[18px]`) dan matriks padat (jadwal, kalender absensi, pembagian mengajar, Buku Klapper).
2. **Kolom isian 16px di HP** (`text-base sm:text-[0.9375rem]`) — di bawah 16px Safari iPhone memperbesar layar sendiri.
3. **"Hari ini" dihitung di WIB**, bukan jam server (server UTC): `new Date(Date.now() + 7*3600_000)` + `getUTC*`, dan
   `toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })`. Libur hari ini dari `cekLibur` (CLAUDE.md #40).
4. Tinggi layar pakai `dvh` (`min-h-dvh`), bukan `vh` (bilah alamat HP).
5. **Halaman server TIDAK mengoper elemen ikon lucide ke komponen klien** (CLAUDE.md #35 — dashboard Admin sempat 500 di
   produksi): `StatTile ikon="siswa"` (nama, bukan `icon={<GraduationCap />}`), tautan berikon lewat `TautanIkon`/`TautanCepat`/
   `KartuTautan` dari `src/components/shared/IkonNama.tsx`. Ikon di markup server murni (PageHeader, Panel) boleh, masing-masing
   sekali. Panah tautan di `Panel` sengaja SVG polos. Cek: `node scripts/cek-ikon-kembar.mjs <berkas>`.
6. Diuji di lebar **360, 390, 768, 1024, 1280, 1440, 1920px**: tidak ada gulir samping, tidak ada teks di bawah 12px.
7. Gaya bersama lama sudah diselaraskan (berlaku semua halaman): `.input-field` 16px di HP & 44px di layar sentuh,
   kepala `.data-table` & `.status-badge`/`.badge` 12px, `.page-card` = sudut & bayangan panel, `Paginasi` ramah sentuh.
   Semua itu dibungkus `@media screen`: dokumen cetak resmi (Nominatif, Rekap Peserta Didik, barcode) memakai kelas yang
   sama dan HARUS tercetak persis seperti sebelumnya — perubahan gaya bersama berikutnya juga wajib khusus layar.
8. **Grid WAJIB punya kolom tegas di HP (`grid grid-cols-1 … md:grid-cols-2`) dan anak grid/kolom isi diberi `min-w-0`.**
   `grid gap-6` tanpa `grid-cols-*` membuat kolom `auto` yang melebar mengikuti teks satu baris terpanjang (`truncate`) →
   halaman bisa digeser ke samping (temuan user 15 Sep 2026: panel Komposisi dashboard Admin meluber di HP, menu bawah ikut
   terpotong). Menguji luber: bandingkan `scrollWidth` dengan LEBAR LAYAR yang diset (bukan `innerWidth` — browser mode HP
   ikut melebarkan area tampilan mengikuti isi yang meluber) dan ulangi dengan ukuran huruf 115% & 130% seperti setelan HP.

## 18. Halaman gabungan berpita tab (27 September 2026)

Beberapa menu yang **satu urusan** dan dibuka berpindah-pindah dalam satu pekerjaan digabung menjadi satu
halaman berpita tab, bukan satu menu per modul. Contoh nyata: **Jaringan & Layar** (CLAUDE.md #85) menyatukan
Papan & TV, Perangkat Jaringan, Jaringan Sekolah, dan Mode Ujian Jaringan — keempatnya membaca router yang sama.

Polanya:
- Halaman `page.tsx` = **server component** yang menghitung hak akses lalu mengoper boolean ke satu komponen
  klien kerangka (`PusatJaringanManager`). Tab yang tidak berhak tidak dirender sama sekali.
- Isi tiap tab = komponen Manager yang **sudah ada**, dipasang dengan prop **`tanpaKerangka`** yang melepas
  `PageHeader` dan padding halaman (`p-6 lg:p-8 pt-16 lg:pt-8`) supaya tidak dobel. Jangan menyalin/menulis
  ulang isinya.
- Pita tab: `alat-tab` + `bg-gray-100 p-1 rounded-xl`, tab aktif **`bg-primary-900 text-white`** (§5.7),
  `overflow-x-auto` untuk HP, tiap tombol `sentuh` + ikon 15px.
- Tab aktif tercermin di `?bagian=` lewat `router.replace(..., { scroll: false })` — bisa ditautkan & dimuat
  ulang tanpa kembali ke tab pertama, dan tombol kembali peramban tidak menelusuri tiap tab.
- Rute menu lama TIDAK dihapus: diganti berkas `page.tsx` berisi `redirect("…?bagian=…")` supaya tautan lama,
  penanda peramban, dan `url` notifikasi yang sudah terkirim tetap sampai. `PETA_ILUSTRASI` (§57 CLAUDE.md)
  mendaftarkan rute gabungan sebagai satu fitur = satu gambar; rute lama tetap terdaftar selama masih hidup.


## 19. PATOKAN TAMPILAN: Dashboard Kurikulum (27 September 2026)

**Keputusan user: "patokan untuk semua halaman adalah dashboard kurikulum untuk beberapa aspeknya".**
`src/components/jabatan/WakasekKurikulumDashboard.tsx` adalah acuan yang dilihat langsung — kalau ragu
bentuk sesuatu, buka berkas itu dan tiru, jangan meracik varian baru. Aspek yang mengikat:

```tsx
<div className="p-6 lg:p-8 pt-16 lg:pt-8">
  <PageHeader icon={<Ikon size={22} />} title="…" description="…" />

  <div className="space-y-6">                             {/* 1. SATU wadah, bukan mb-5 per blok */}
    <div className="kisi-kartu kisi-kartu-5">…StatTile…</div>          {/* 2. kartu angka */}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">           {/* 3. baris PINTASAN */}
      {pintasan.map(t => (
        <Link key={t.href} href={t.href} className="panel panel-interaktif flex items-center gap-3 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white"><t.ikon size={16} /></span>
          <span className="min-w-0 text-sm font-semibold text-primary-900">{t.label}</span>
        </Link>
      ))}
    </div>

    <div className="baris-alat">                                       {/* 4. PITA TAB */}
      <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
        <button className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
          aktif ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>…</button>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start"> {/* 5. isi dua kolom */}
      <div className="panel overflow-hidden xl:col-span-8"><div className="overflow-x-auto"><table className="data-table">…</table></div></div>
      <div className="panel p-5 xl:col-span-4">…</div>
    </div>
  </div>
</div>
```

Catatan per aspek:
1. **`space-y-6`** sebagai satu wadah isi — bukan `mb-5`/`mb-6` yang ditempel per blok. Jaraknya jadi sama
   di semua halaman tanpa perlu diingat satu-satu.
2. **Baris pintasan = halaman TETANGGA**, bukan pengulangan tab di bawahnya: 3–4 tautan yang memang jadi
   langkah berikutnya setelah melihat angka. Dari portal guru JANGAN menautkan rute `/dashboard/admin/*`
   (CLAUDE.md #45) — pakai `tautanJabatan(basePath, …)` atau saring per portal.
3. **Pita tab PUTIH BERGARIS** (`border border-gray-100 bg-white p-1`), tab aktif `bg-primary-900 text-white`,
   non-aktif `text-gray-500 hover:bg-gray-50`. Ini MEMBALIK catatan lama `bg-gray-100` di §4.1 — 17 pita
   disapu 27 Sep 2026, dan `hover:bg-white` pada tab non-aktif wajib ikut diganti (di atas pita putih,
   hover putih tidak terlihat sama sekali).
4. Tabel selalu `panel overflow-hidden` → `overflow-x-auto` → `.data-table` (§5.7 butuh wadah itu untuk freeze).
5. Kemajuan/persentase = batang tipis `h-1.5 rounded-full bg-gray-100` berisi `bg-emerald-500`/`bg-amber-400`,
   bukan angka persen telanjang. Status = `status-badge` + pasangan warna §2.

**`.page-card` TIDAK perlu diganti `.panel`** — di layar keduanya sudah identik (`@media screen` menyetel
sudut, garis, dan bayangan `.page-card` persis seperti `.panel`, §17.4 butir 7). Mengganti 37 berkas hanya
menambah risiko tanpa perubahan tampilan.

### 19.1 Pemeriksa keseragaman — `node scripts/cek-keseragaman.mjs` (27 September 2026)

Permintaan user: "fokus penyeragaman semua halaman baik itu tombol2 dan tata letak dan lain2". Sapuan
manual selalu luntur karena fitur baru menambah racikan lagi, jadi patokannya dijadikan **pemeriksa**:
jalankan tanpa argumen untuk seluruh `src`, atau dengan daftar berkas yang diubah. Keluar dengan kode 1
bila ada temuan, jadi bisa dipasang di rantai build seperti `cek-ikon-kembar.mjs` & `cek-tombol-kembali.mjs`.

Yang diperiksa: tombol racikan · kelas berlebih pada `.btn-*` · huruf <12px di layar · kartu racikan →
`.panel` · pita tab abu & `hover:bg-white` di pita putih · `min-h-screen` → `min-h-dvh` · token
`primary-200/400/600/800` · `<select>`/`<input type=date|month|time>` bawaan · `window.confirm` · grid
kartu angka tanpa `.kisi-kartu` · `PageHeader` dibungkus `print:hidden` · tabel layar tanpa wadah
`overflow-x-auto` · **kolom No tabel tanpa lebar tetap** · **sel angka tanpa `tabular-nums`** · **jarak bawah blok bukan `mb-5`** · **judul kartu portal masih `font-bold`**.

**Pengecualiannya sudah TERBUKTI, bukan dugaan** — tiap audit, sekitar separuh temuan ternyata sah:
dokumen cetak & pratinjau kertas (dikenali dari `print-doc`/`a4-page`/`@page`/`PrintKop`), matriks padat
(jadwal, kalender absensi, pembagian mengajar, Buku Klapper, denah ruang), lingkaran penghitung kecil &
`<sup>`, item sidebar, tombol melayang, tombol kembali di kepala navy `PortalShell`, dan papan dinding TV
(ukurannya `vh`-based dan layarnya terkunci setinggi layar — CLAUDE.md #81). Jangan menambah pengecualian
baru tanpa benar-benar membuka berkasnya; kalau pemeriksa jadi terlalu longgar, angka nol-nya tidak berarti
apa pun. Cara mengujinya: buat berkas berisi pelanggaran yang disengaja dan pastikan semuanya tertangkap.

**Hasil sapuan 27 September 2026:** 41 tombol racikan → kelas baku (termasuk 4 di situs publik yang
menyalin `.btn-primary` dengan tangan, 2 tombol Hapus di panel penyunting → `.btn-hapus`, dan 4 tautan
dokumen ujian); 9 kelas berlebih dibersihkan; 58 `min-h-screen` → `min-h-dvh` di 47 berkas; 25 kartu
racikan → `.panel`; 50 huruf di bawah 12px dinaikkan (44 di antaranya di `JaringanManager`, berkas yang
belum pernah ikut sapuan sebelumnya); 1 grid kartu angka → `.kisi-kartu`; 1 tombol hapus baris tabel
disamakan ke ukuran §15.2.

### 19.2 Dua hal yang baru diseragamkan 27 September 2026 (putaran tata letak)

1. **Jarak bawah blok = `mb-5`.** `kisi-kartu`, `baris-alat`, dan `alat-aksi justify-end` dulu bercampur
   `mb-3/4/5/6` — 20px di satu halaman, 24px di halaman berikutnya, dan itu terlihat saat berpindah menu.
   Majoritasnya memang sudah `mb-5` (27/66/47) dan itu pula yang tertulis di §3.1 & §4.1, jadi **49 jarak
   menyimpang diseragamkan ke `mb-5`**. Blok yang berada di dalam wadah `space-y-6` (pola Kurikulum) tidak
   memakai `mb-*` sama sekali — jaraknya dari wadahnya.
2. **Judul kartu/seksi di PORTAL = `font-semibold` (600), bukan `font-bold`.** Patokannya dua-duanya
   sepakat: `.panel-judul` di globals.css memakai `font-weight: 600`, dan judul kartu Dashboard Kurikulum
   `font-heading font-semibold text-navy text-sm mb-3`. Yang racikan justru mayoritas `font-bold` (160
   tanda) — mayoritas di sini BUKAN patokan. **61 judul heading di 31 berkas portal** diturunkan ke 600.
   **Situs PUBLIK sengaja TIDAK ikut**: halaman pemasaran (Alumni, Program, Ekstrakurikuler) memang lebih
   tebal, dan menyeragamkannya ke bobot portal akan memucatkan tampilannya tanpa diminta.
   `text-navy` dan `text-primary-900` adalah hex yang SAMA (§2 menyebut `navy` alias semantik) — keduanya
   sah, jadi tidak ikut diseragamkan; yang diperbaiki hanya bobotnya.

### 19.3 Pesan "Belum ada…" / "Tidak ada…" (27 September 2026)

Ada 96 pesan kosong racikan dengan **46 gaya berbeda** — ukuran 12px/14px bercampur, warna `gray-400`
dan `gray-500` bercampur, jarak vertikal `py-2` sampai `py-20`, sebagian miring. Itu paling terasa saat
berpindah halaman karena keadaan kosong justru sering terlihat.

Dua bentuk baku sekarang:
```tsx
{/* Sebaris di dalam panel/kartu */}
<p className="text-sm text-gray-400">Belum ada data.</p>
{/* Blok yang ditengahkan */}
<p className="py-10 text-center text-sm text-gray-400">Belum ada data.</p>
```
- **Selalu 14px** (`text-sm`) dan **warna disebut tegas** — jangan mewarisi warna teks sekitarnya.
- Blok yang ditengahkan **selalu `py-10`**. `EmptyState` (py-16 + ikon besar) tetap untuk keadaan kosong
  LEVEL HALAMAN/TABEL; `PanelKosong` (py-8 + chip ikon) untuk di dalam panel bila memang mau berikon.
- **Latar gelap dikecualikan** (papan TV, kiosk, panel navy): `text-white/40` punya skalanya sendiri.
- Pesan yang memang BERWARNA SEMANTIK (hijau "sudah lengkap", amber "perlu tindakan") tetap warnanya —
  jangan ditambahi `text-gray-400`. Ini bekas kesalahan nyata: sapuan pertama menambahkan `text-gray-400`
  pada tiga pesan yang sudah punya warna, sehingga ada DUA warna teks di satu elemen.

**Batas pemeriksa yang perlu diketahui:** pengecualian dokumen cetak bekerja per BERKAS. Komponen campuran
(punya bagian layar DAN lembar cetak dalam satu berkas — `JaringanManager`, `PengawasKelasPanel`) jadi ikut
kebal, sehingga penyimpangan di bagian layarnya harus diperiksa manual. Penanda cetaknya juga sengaja hanya
yang menandai LEMBAR (`print-doc`, `a4-page`, `SheetShell`, `LembarBerhalaman`, `@page`) — `PrintKop` dan
`PrintButton` TERLALU LEMAH: halaman layar biasa pun punya tombol cetak, dan sekali kata itu muncul seluruh
berkas jadi kebal (terbukti 27 Sep 2026, `JaringanManager` lolos hanya karena itu).

### 19.4 Spinner memuat (27 September 2026)

Dua gaya beredar: `Loader2 size={24}` ABU di kotak `min-h-[60vh]` (42×) dan `size={28}` NAVY di
`flex justify-center py-16` (48×) — dua ukuran dan dua warna untuk hal yang sama. Patokannya §15.1 dan
Dashboard Kurikulum: **abu, ukuran 24**. Disapu: 48 spinner 28→24, 82 `text-primary-500`→`text-gray-400`,
dan 4 spinner blok berukuran 32 diturunkan.

- **Blok memuat** (halaman & kartu): `<Loader2 size={24} className="animate-spin" />` di wadah bertext
  `text-gray-400` — `min-h-[60vh]` untuk level halaman, `py-16` untuk di dalam kartu. Keduanya sah.
- **Spinner SEBARIS menyesuaikan ikon sebelahnya**, bukan 24: 11px di tombol berikon 11px, 14–15px di
  baris tabel. Pemeriksa sengaja hanya menandai ukuran ≥28 — menyeragamkan yang sebaris ke 24 akan membuat
  tombol kecil melonjak.
- **Di dalam tombol gelap JANGAN diberi warna**: spinnernya mewarisi teks putih tombol. Memberi
  `text-gray-400` di sana membuatnya nyaris tak terlihat — diperiksa setelah sapuan ini, tidak ada satu pun
  yang kena.

### 19.5 Urutan & jarak isi halaman — WAJIB (27 September 2026, teguran user)

User menemukan lima dashboard dengan **pintasan di ATAS kartu angka** (terbalik dari patokan Kurikulum),
tombol "Inventaris Barang" melayang sendirian di atas kartu, dan blok-blok yang **"sangat mepet"**.
Ketiganya berasal dari kesalahan yang sama: blok disisipkan tepat di bawah `PageHeader` dan jaraknya
diatur `mb-*` per blok, bukan oleh satu wadah.

**Urutan baku (melengkapi §17.3):**
```
PageHeader
  → pemberitahuan yang perlu tindakan (hanya bila ada)   ← notice amber/merah, BOLEH di atas kartu
  → KARTU ANGKA (.kisi-kartu)                            ← blok pertama yang terlihat
  → baris pintasan (grid grid-cols-2 gap-3 lg:grid-cols-4)
  → baris alat (.baris-alat / .alat-aksi)
  → isi (panel, tabel, grafik)
```
**Di halaman yang punya kartu angka, kartu itu WAJIB blok pertama** — bukan tombol, bukan pintasan, bukan
baris cari. Tombol yang berdiri sendiri di atas kartu terlihat melayang tanpa jangkar. Disapu 27 Sep 2026:
11 halaman dipindahkan. Pengecualian: pemberitahuan (§17.3) dan `BarisKembali` (§4.2) memang di atas.

**Jarak antar blok TIDAK diatur `mb-*` per blok, melainkan satu wadah `<div className="space-y-6">`**
tepat di bawah `PageHeader`. Dengan `mb-*` per blok, satu blok yang lupa diberi jarak langsung menempel ke
tetangganya — dan itulah yang terjadi. Enam dashboard jabatan dibungkus ulang 27 Sep 2026; `mb-*` pada anak
langsungnya dilepas supaya tidak dobel.

### 19.6 Tabel sejajar (28 September 2026)

Keluhan "tabel yang tidak sejajar" dari brief design system ternyata dua hal berbeda, dan hanya
salah satunya soal rata kepala-vs-isi:

1. **Kolom "No" = `w-10`, selalu.** Lebarnya dulu terpecah empat versi (`w-8`, `w-10`, `w-12`, dan
   tanpa lebar sama sekali) di 115 tabel layar, sehingga kolom pertama mulai di titik x yang
   berbeda tiap halaman — itu yang terbaca sebagai "tidak sejajar" saat berpindah menu. 13 kepala
   kolom diseragamkan. **Rata isinya mengikuti selnya**, tidak dipaksa: mayoritas rata kiri dengan
   `.angka` (17 tabel) dan itu yang jadi patokan; yang sudah rata tengah beserta selnya (matriks &
   grid isian) dibiarkan karena kepala dan isinya memang sudah sejajar. Yang **dikecualikan**:
   dokumen cetak, matriks padat, dan kolom beku berkepala navy (`sticky left-0`) yang lebarnya
   diatur bersama matriksnya.
2. **Sel angka wajib `.angka`** (`tabular-nums`). Tanpa itu digit berlebar berbeda dan kolom angka
   tidak berbaris walau rata kanannya benar. Uang dirata KANAN di kepala DAN sel sekaligus
   (Nominal di Bantuan Siswa, Perkiraan di Usulan Alat) — merata-kanankan hanya selnya justru
   menambah ketidaksejajaran baru.

Dua hal yang TERBUKTI bukan pelanggaran, jangan "diperbaiki": kolom aksi yang `<th>`-nya
`text-right` sementara `<td>`-nya merata lewat `justify-end` di div dalamnya (5 kasus diperiksa
satu per satu — semuanya benar), dan `.length` yang dipakai sebagai syarat ternary yang
mengembalikan JSX (`{x.length ? x.map(…) : "—"}`) — itu bukan sel angka.

**Pelajaran alat ukur:** `className` di repo ini sering berupa **template literal**
(`className={`text-right ${warna(x)}`}`), jadi penyaring yang hanya membaca `className="…"`
menganggapnya kosong. Audit pertama saya melaporkan 6 sel angka bermasalah — 3 di antaranya
ternyata sudah benar, termasuk satu di berkas patokan Kurikulum sendiri. Pola pemeriksa membaca
kedua bentuk.

## 20. Fondasi token & komponen bersama (27 September 2026)

Permintaan user: aplikasi diseragamkan sebagai design system berstandar enterprise, dengan keluhan
konkret — **spasi tidak teratur, tinggi kartu tidak sama, ukuran font acak, bentuk tombol tidak
seragam, tabel tidak sejajar, dan kartu pintasan bentuknya berbeda-beda**.

**Fondasinya TIDAK dibuat ulang.** Repo ini sudah punya `@theme` (warna, font, bayangan, easing) +
19 bagian dokumen ini + pemeriksa otomatis. Membuat `variables.css` kedua di sampingnya akan menjadi
sistem paralel yang bertabrakan dengan 272 halaman yang sudah memakai token lama. Yang ditambahkan
hanyalah tiga token yang memang BELUM ada dan justru jadi sumber ketidakrapian:

### 20.1 Skala spasi (globals.css, blok "TOKEN PELENGKAP")
| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--spacing-rapat` | 4px | jarak ikon ke teks di dalam chip |
| `--spacing-kecil` | 8px | antar tombol dalam satu baris |
| `--spacing-sedang` | 16px | padding isi panel di HP |
| `--spacing-blok` | 20px | jarak bawah baris alat (`mb-5`, §19.2) |
| `--spacing-seksi` | 24px | jarak antar seksi (`space-y-6`, §19.5) |
| `--spacing-halaman` | 32px | padding halaman di layar lebar (`lg:p-8`) |
| `--spacing-lega` | 48px | jarak sebelum blok penutup |

Bentuk: `--radius-kartu` 16px (panel, kartu angka, ubin pintasan) · `--radius-kontrol` 12px (tombol,
isian, dropdown) · `--radius-chip` pil (badge, status, CTA publik). Jangan meracik radius per halaman.

### 20.2 Tinggi kartu seragam
Keluhan "tinggi kartu tidak sama" **bukan** salah kartunya melainkan GRID-nya: label yang membungkus
dua baris membuat kartu itu lebih tinggi, tetangganya tetap pendek. `.kisi-kartu` sekarang
`align-items: stretch` dan anaknya `height: 100%`, jadi semua kartu dalam satu baris setinggi yang
tertinggi. Tidak ada yang perlu diubah di halaman.

### 20.3 `<BarisPintasan>` — satu komponen, bukan salin-tempel
Markup ubin pintasan sebelumnya **disalin-tempel ke 13 berkas**, sehingga tinggi, padding, dan ukuran
ikonnya pelan-pelan berbeda — itulah "kartu pintasan bentuknya berbeda-beda". Sekarang:
```tsx
import BarisPintasan from "@/components/shared/BarisPintasan";
<BarisPintasan items={[{ href, label, ikon: Users }, …]} />
```
- Bentuknya di `.kisi-pintasan` / `.ubin-pintasan` (globals.css), markupnya hanya di komponen itu.
- **Dua varian saja**: ringkas (ikon + label) dan berketerangan (`ket` → dua baris + panah).
  `sorot: true` menandai yang perlu perhatian. Jangan menambah varian ketiga di halaman.
- Letaknya SELALU setelah kartu angka (§19.5), isinya halaman TETANGGA — bukan pengulangan menu.
