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
(loncat, bukan skala 100-900 penuh).

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

**Gradient navy standar** (header `PageHeader`, `Modal`, `GroupedSection` non-warning) — SELALU
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

### 3.3 Header "hero" landing tiap portal
`/dashboard/admin/page.tsx`, `/dashboard/teacher/page.tsx`, `/dashboard/student/page.tsx` —
header sapaan gradient WAJIB `sticky top-14 lg:top-0 z-30` (sesuaikan `top-*` dengan tinggi
topbar mobile portal masing-masing — Admin pakai `top-16`), supaya konsisten dengan
`PageHeader` yang sudah sticky di semua halaman lain.

### 3.4 Sidebar
`AdminSidebar`, `TasSidebar`, `TeacherSidebar`, `StudentSidebar` — semua:
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
| `GroupedSection` | Kartu grup tabel dgn header bar navy + badge jumlah — dipakai HAMPIR SEMUA tabel admin yang dikelompokkan (lihat §5) |
| `EmptyState` | Kondisi "belum ada data" (ikon abu-abu + teks tengah, py-16) |

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
| `.btn-modal-save` | `primary-700`→`primary-900` hover, `disabled:opacity-50` | Tombol simpan di footer `Modal`/form admin |
| `.btn-modal-cancel` | putih, border abu, hover abu muda | Tombol batal di footer `Modal`/form admin |

Semua tombol: `border-radius` besar (`9999px` untuk CTA publik, `0.75rem` untuk tombol
modal/admin), `transition: all 0.3s` atau `0.15s` untuk yang kecil. Ikon di dalam tombol pakai
lucide-react, ukuran mengikuti konteks (lihat §9).

Tombol "Cetak" / link ke halaman print: **JANGAN PERNAH `target="_blank"`** kecuali 2
pengecualian sah (`bel-sekolah/player`, `persuratan/[id]/edit-word` — lihat gotcha #19). Semua
halaman cetak lain WAJIB navigasi tab yang sama + punya tombol "Kembali" (`ArrowLeft`) sendiri.

---

## 5. Tabel & Data Display

### 5.1 Tabel data
`.data-table` (utility class siap pakai): header gradient navy (`linear-gradient(135deg,
#0F1A45 0%, #1B2B6B 100%)`), teks header putih 70% opacity, uppercase, `letter-spacing: 0.08em`,
`font-size: 0.7rem`; body `text-sm`, hover row `#f8f9fc`, border antar baris `#f1f3f7`, sudut
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
`variant="warning"` (bar oranye solid, bukan gradient navy) khusus untuk grup yang perlu
perhatian, mis. "Belum Ada Kelas" / "Belum Absen". `headerActions` untuk tombol kecil di header
grup (mis. "Cetak Kelas Ini") — TETAP ikuti aturan §3.2 kalau ini di level halaman (bukan di
dalam grup), tapi di dalam `GroupedSection` per-grup memang disediakan slot resminya sendiri.

### 5.3 Kartu ringkasan angka → `StatTile`
```tsx
<StatTile value={128} label="Total Siswa" icon={Users} color="primary" />
```
`size="sm"` kalau `value` berpotensi teks panjang (bukan angka pendek) — supaya tidak
memaksa tinggi kartu tetangga di grid yang sama.

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
**Tidak ada komponen `Pagination` shared** — mayoritas tabel di aplikasi ini memakai
strategi "load semua + filter/cari di client" (dataset per sekolah relatif kecil: puluhan
siswa per kelas, ratusan total). Baru pakai pagination betulan kalau dataset memang besar dan
bertumbuh tanpa batas alami (contoh nyata satu-satunya: **Log Aktivitas**,
`src/components/admin/LogAktivitasClient.tsx`). Kalau perlu menambah pagination di halaman
baru, ikuti pola nyata ini (bukan bikin gaya baru):
```tsx
const pageSize = 50;
const totalPages = Math.max(1, Math.ceil(total / pageSize));
// ...
{totalPages > 1 && (
  <div className="flex items-center justify-between mt-4 text-sm">
    <p className="text-gray-400">Halaman {page} dari {totalPages} · {total} total data</p>
    <div className="flex gap-2">
      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
        Sebelumnya
      </button>
      <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
        Berikutnya
      </button>
    </div>
  </div>
)}
```
Server-side: kirim `total` + slice `skip`/`take` dari Prisma, jangan paginate di client dari
dataset yang sudah di-fetch penuh kalau datanya memang besar (percuma).

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

### 11.5 Export CSV
Selalu BOM UTF-8 di awal (`"﻿"` / `"﻿"`) + quote tiap field + escape `"` ganda — lihat
pola lengkap di CLAUDE.md bagian Export CSV. Tanpa BOM, Excel Indonesia salah baca karakter
khusus.

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
| `z-50` | `Modal` backdrop, sidebar overlay mobile, tombol mengambang `fixed` (mis. toggle layar penuh leaderboard, `WhatsAppButton`) |
| `z-[60]` | Popup dropdown `Select` (harus di atas isi `Modal`, karena `Select` sering dipakai di dalam form modal) |
| `z-[100]` | `ToastProvider` — paling atas, harus selalu terlihat di atas apapun termasuk `Modal` |

---

## 16. Referensi Silang

- `CLAUDE.md` — 24 gotcha teknis (auth/session, Prisma, build Docker, dll) — WAJIB dibaca bersama dokumen ini, saling melengkapi bukan duplikat.
- `AGENTS.md` — peringatan versi Next.js non-standar, cek `node_modules/next/dist/docs/` sebelum pakai API yang tidak yakin.
