@AGENTS.md
@DESIGN_SYSTEM.md

# CLAUDE.md

Panduan ini membantu Claude Code saat bekerja di repositori ini.

**`DESIGN_SYSTEM.md`** (di-include otomatis di atas) adalah patokan WAJIB untuk font, warna,
layout, komponen, tabel, dropdown, tombol, pagination, dan cetak — dipakai di SETIAP pembuatan
atau perubahan halaman, bukan cuma referensi opsional.

## Apa ini

**SMK Al-Munawwir IIBS** — website resmi sekolah sekaligus sistem manajemen akademik. Tiga jenis pengguna: **ADMIN** (kepala sekolah/TU), **TEACHER** (guru), **STUDENT** (siswa). Fitur publik: profil sekolah, berita, galeri, PPDB online. Fitur internal: manajemen kelas/jurusan/siswa/guru, input nilai, absensi, PKL, rapor cetak, ekspor CSV, pengaturan konten website.

Bahasa UI & komunikasi dengan user: **Bahasa Indonesia**.

## Menjalankan

```bash
npm run dev          # Turbopack dev server → http://localhost:3000
npm run build        # Build produksi
npx prisma studio    # GUI database
npx prisma db push   # Terapkan perubahan schema (tanpa migration file)
npm run db:migrate   # Buat migration file + terapkan
npx prisma db seed   # Isi data contoh (pakai ts-node --esm)
```

**Environment variables** wajib di `.env.local`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/smk_almunawwir"
SESSION_SECRET="min-32-karakter-random"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

PostgreSQL 17 lokal (diinstal via winget). Pastikan service berjalan sebelum `npm run dev`.

## Stack Utama

- **Next.js 16.2.9** + React 19 + TypeScript + Tailwind CSS v4
- **Prisma 7** + `@prisma/adapter-pg` (wajib pakai Pool dari `pg` — bukan koneksi default Prisma)
- **jose** — JWT untuk session (disimpan di HttpOnly cookie `session`, sliding window 8 jam — lihat bagian Auth & Session)
- **bcryptjs** — hash password
- **lucide-react** — ikon
- **Turbopack** dipakai saat `npm run dev` (bawaan Next.js 16)

## Auth & Session (PALING PENTING)

Session disimpan sebagai **JWT di cookie `session`** (HttpOnly, SameSite=lax), **sliding window 8 jam**
(bukan fixed-expiry) — tiap request (halaman `/dashboard/**` MAUPUN `/api/**`) yang bawa cookie sesi
valid otomatis memperpanjang lagi 8 jam dari saat itu (`src/proxy.ts` memanggil `refreshSessionCookie`
di `session.ts` di HAMPIR SETIAP request). Jadi selama user aktif (termasuk sekadar halaman polling data
tanpa pindah halaman, mis. Papan Peringkat mode layar penuh), TIDAK akan ke-logout paksa — cuma idle
total >8 jam yang bikin sesi benar2 kadaluarsa. Durasi ini keputusan eksplisit user (bukan 7 hari
seperti sebelumnya) karena banyak device TU/lab dipakai bergantian.

```
src/lib/session.ts   ← encrypt/decrypt JWT, createSession, deleteSession, getSession, refreshSessionCookie
src/lib/dal.ts       ← verifySession(), verifyRole(["ADMIN"|"TEACHER"|"STUDENT"])
src/proxy.ts          ← Next.js 16 "Proxy" (BUKAN middleware.ts — nama file berubah versi ini),
                         jalan di semua route KECUALI _next/static, _next/image, favicon.ico, *.svg
```

**Wajib dipakai di setiap server component/route yang butuh auth:**
```ts
// Server Component
const session = await verifyRole(["ADMIN"]);
// session.userId, session.email, session.name, session.role

// API Route
const session = await verifyRole(["ADMIN", "TEACHER"]);
```

`verifyRole` redirect ke `/login` jika tidak login atau role tidak cocok. Jangan cek auth manual — selalu pakai `verifyRole`.

`src/lib/dal.ts` diberi `import "server-only"` → **tidak bisa dipakai di client component**. Untuk client, fetch dari API route yang sudah melakukan verifikasi.

## Database & Prisma

**`src/lib/prisma.ts`** — singleton Prisma client dengan `@prisma/adapter-pg`. Pakai di server component dan API route:
```ts
import { prisma } from "@/lib/prisma";
```

**Schema utama** (`prisma/schema.prisma`):
- `User` — id, name, email, passwordHash, role (ADMIN/TEACHER/STUDENT)
- `Student` — id, nis, nisn, userId, classId, majorId + relasi ke Grade/Attendance/Internship
- `Teacher` — id, nip, subject, phone, userId, homeroomOf (kelas wali)
- `Class` — id, name, grade (10/11/12), majorId, homeroomId
- `Major` — id, name, code, description, icon
- `Grade` — id, studentId, teacherId, subject, score, type, semester (**TANPA unique constraint**)
- `Attendance` — id, studentId, date, status (HADIR/IZIN/SAKIT/ALPHA) (**TANPA unique constraint**)
- `Internship` — id, studentId (`@unique`), company, position, supervisor, startDate, endDate, status
- `Admission` — formulir PPDB online
- `News`, `Gallery`, `HeroBanner`, `SiteSetting`, `ContactMessage` — konten website

**Seed** memerlukan `process.loadEnvFile()` sebelum import Prisma (karena Prisma 7):
```ts
// prisma/seed.ts — baris pertama wajib:
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {}
// baru import PrismaClient setelah ini
```

## Pola Kode Penting

### Server Component dengan Prisma
Wajib tambahkan `export const dynamic = "force-dynamic"` di atas file:
```tsx
export const dynamic = "force-dynamic";
// baru import dan pakai prisma
```

### Dynamic Route Params
Params di Next.js 16 berbentuk Promise — harus di-await:
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### Client Component
Jangan pakai Prisma di "use client". Fetch dari API route:
```tsx
"use client";
// fetch("/api/admin/students") — bukan import prisma
```

Server component boleh render client component. Jika server component butuh event handler → ekstrak event handler ke file terpisah "use client".

### Duplikasi Grade/Attendance
Grade dan Attendance **tidak punya unique constraint di DB**. Untuk mencegah duplikat, wajib gunakan transaction delete-then-create:
```ts
await prisma.$transaction(async (tx) => {
  for (const g of grades) {
    await tx.grade.deleteMany({ where: { studentId: g.studentId, teacherId, subject, type, semester } });
    await tx.grade.create({ data: { ... } });
  }
});
```
Jangan pakai `createMany` dengan `skipDuplicates` — tidak akan kerja tanpa constraint DB.

### Export CSV (UTF-8 BOM)
Semua file CSV untuk download wajib diawali BOM agar Excel Indonesia bisa baca karakter khusus:
```ts
const BOM = "﻿"; // ﻿
const csv = BOM + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nama.csv"` } });
```

### React.ElementType di React 19
Jika pakai `React.ElementType` sebagai tipe, wajib import React secara eksplisit:
```ts
import React, { useState, useEffect } from "react";
// bukan: import { useState, useEffect } from "react";
```

## Struktur Folder

```
src/
  app/
    (public)/              ← halaman publik (/, /about, /news, dll)
    api/
      admin/               ← API untuk admin (CRUD data, export CSV)
      teacher/             ← API untuk guru (nilai, absensi, kelas)
      student/             ← API untuk siswa
      profile/             ← API ganti password (semua role)
      banners/             ← API public banner hero
    dashboard/
      admin/               ← Panel admin (layout + sidebar)
      teacher/             ← Portal guru (layout + sidebar)
      student/             ← Portal siswa (tanpa sidebar, standalone header)
    login/
    actions/auth.ts        ← Server actions: login, logout
  components/
    admin/                 ← AdminSidebar, ContentEditor, dll
    teacher/               ← TeacherSidebar
    shared/                ← ChangePasswordForm, PrintButton, IslamicQuote
    layout/                ← Navbar, Footer (public)
    sections/              ← Hero, GalleryGrid, AdmissionsForm (public)
  lib/
    prisma.ts              ← Prisma singleton
    dal.ts                 ← verifySession, verifyRole (server-only)
    session.ts             ← JWT encrypt/decrypt, createSession
    site-settings.ts       ← DEFAULTS + getSettings (SiteSetting model)
  types/                   ← TypeScript types (Role, SessionPayload, dll)
prisma/
  schema.prisma
  seed.ts
public/
  images/                  ← Gambar statis (logo, dll)
  uploads/                 ← Upload dari admin (banner, thumbnail berita, galeri)
```

## Navigasi Dashboard

### Admin (`/dashboard/admin/`)
Sidebar di `src/components/admin/AdminSidebar.tsx` — menerima props `unreadMessages` dan `pendingAdmissions` dari layout (server-fetched) untuk badge notifikasi.

Menu: Dashboard, Banner/Hero, Berita, Galeri Foto, Pendaftaran, **Jurusan**, Kelas, Siswa, **PKL**, Guru, Akun Pengguna, Pesan Masuk, Konten Halaman, **Laporan & Ekspor**, Profil Admin.

### Guru (`/dashboard/teacher/`)
Sidebar di `src/components/teacher/TeacherSidebar.tsx`.
Menu: Dashboard, Daftar Siswa, Input Nilai, Absensi, Profil Saya.

Guru hanya punya akses ke kelas yang mereka jadi wali kelas (`teacher.homeroomOf`). Scope selalu di-filter berdasarkan ini di API.

### Siswa (`/dashboard/student/`)
Tidak pakai sidebar — standalone header dengan icon Rapor, Profil, Logout.

## Fitur Export CSV

| Endpoint | Scope | Filter |
|---|---|---|
| `GET /api/admin/export/admissions` | Admin | — |
| `GET /api/admin/export/students` | Admin | — |
| `GET /api/admin/export/attendance` | Admin | `?month=YYYY-MM` |
| `GET /api/admin/export/grades` | Admin | `?classId=&semester=` |
| `GET /api/admin/export/pkl` | Admin | — |
| `GET /api/teacher/export/grades` | Guru (kelas wali saja) | `?classId=&semester=` |
| `GET /api/teacher/export/attendance` | Guru (kelas wali saja) | `?classId=&month=YYYY-MM` |

## Gotcha & Hal Wajib Diingat

1. **`export const dynamic = "force-dynamic"`** — wajib di setiap server component yang memanggil Prisma, LANGSUNG maupun TIDAK LANGSUNG (misal lewat `<Footer />`/`<Navbar />` yang sekarang query `prisma.major.findMany()`). Tanpa ini bukan cuma cache stale — build Docker bisa GAGAL TOTAL (`DatabaseNotReachable`) karena Next.js mencoba prerender halaman itu secara statis saat build image, padahal DB tidak reachable dari build stage. Kalau menambah halaman publik baru yang render `<Footer />`, pastikan halaman itu juga punya baris ini. **Ini juga berlaku untuk file spesial `src/app/not-found.tsx`** — karena render `<Footer />`, halaman ini juga wajib punya `export const dynamic = "force-dynamic"`, jika tidak build gagal di step `/_not-found`. API route (`route.ts`) publik tanpa auth (tidak panggil `verifyRole`/cookies) yang query Prisma juga wajib pakai baris ini — route yang sudah pakai `verifyRole` otomatis dynamic karena baca cookie session, tapi route publik polos (contoh: `/api/public/majors`) tidak otomatis dan bisa gagal build kalau lupa.
   **PENTING — `force-dynamic` saja TIDAK CUKUP menjamin build sukses.** Next.js tetap melakukan "trial render" beberapa halaman lain saat build (build worker memproses banyak page secara paralel, error dari satu page kadang ter-atribusi ke page lain di log karena interleaving). Build hanya benar-benar aman kalau SETIAP query Prisma yang dipanggil dari komponen yang dipakai luas (`Footer`, `Programs`, `Stats`, dsb) DIBUNGKUS `.catch(() => fallbackValue)` — persis pola yang sudah dipakai `getSettings()` (`src/lib/site-settings.ts`, try/catch dengan fallback ke `DEFAULTS`). Kalau menambah query Prisma baru di server component yang dipakai banyak halaman publik, SELALU tambahkan `.catch(() => [] / 0 / null)` di query itu sendiri, jangan andalkan `force-dynamic` saja.

2. **Prisma 7 seed** — selalu pakai `process.loadEnvFile()` di baris pertama `prisma/seed.ts` sebelum import apapun dari `@prisma/client`. Tanpa ini seed tidak bisa baca `DATABASE_URL`.

3. **`params` adalah Promise** — di Next.js 16 App Router, `params` dan `searchParams` keduanya adalah Promise. Wajib `await`:
   ```ts
   const { id } = await params;
   const { q } = await searchParams;
   ```

4. **PrintButton terpisah** — `rapor/page.tsx` adalah server component. Karena butuh `window.print()`, fungsi ini ada di `src/components/shared/PrintButton.tsx` sebagai "use client" terpisah.

5. **AdminSidebar adalah "use client"** — menerima badge counts sebagai props dari server component layout (`/dashboard/admin/layout.tsx`). Props harus serializable (number, string, dll — bukan fungsi/class).

6. **SiteSettings** — konten website yang bisa diubah admin disimpan di tabel `SiteSetting`. Akses via `src/lib/site-settings.ts` fungsi `getSettings(keys)`. Default values ada di `DEFAULTS`.

7. **Upload gambar** — disimpan ke `public/uploads/` melalui API `POST /api/upload`. URL disimpan di DB sebagai path relatif (contoh: `/uploads/nama-file.jpg`). Render dengan `<Image src={url} />` dari Next.js.

8. **Internship upsert** — `Internship.studentId` punya `@unique`. Gunakan `prisma.internship.upsert({ where: { studentId }, ... })`.

9. **Semester dinamis** — jangan hardcode semester. Pakai fungsi `generateSemesters()` yang menghitung berdasarkan bulan sekarang (Juli+ = tahun ajaran baru). Contoh ada di `src/app/dashboard/teacher/grades/[classId]/page.tsx`.

10. **Kelas wali guru** — endpoint API guru wajib scope ke kelas yang benar-benar berhak diakses guru itu (bukan semua kelas). Ini WAJIB dicek di setiap endpoint baru `/api/teacher/**` yang menerima `classId`/`studentId` dari client — jangan percaya begitu saja (kalau tidak divalidasi, itu celah IDOR/data leak — pernah kejadian nyata di `/api/teacher/attendance`, `/api/teacher/students`, `/api/teacher/grades`, semuanya sudah diperbaiki).
    - **Nilai** (per keputusan eksplisit user): guru wali kelas boleh akses SEMUA mapel siswa di kelas walinya (`teacher.homeroomOf`). Guru mapel yang BUKAN wali kelas tetap boleh input Nilai, TAPI KHUSUS untuk mapel yang benar-benar diampunya sesuai `TeachingAssignment` (`teacher.teachingLoad`) di kelas tsb — bukan bebas mapel apapun. Endpoint `/api/teacher/classes` (dipakai halaman Nilai) mengembalikan gabungan `homeroomOf` ∪ kelas dari `teachingLoad`; validasi per-mapel yang sebenarnya terjadi di `/api/teacher/grades` POST (cek `isAssignedSubject`).
    - **Absensi** (per keputusan terbaru — MEMBALIK kebijakan lama di atas): KHUSUS wali kelas, TIDAK LAGI terbuka utk guru mapel biasa via `teachingLoad`. Menu "Absensi" di `TeacherSidebar` cuma tampil kalau `hasHomeroom`. `/api/teacher/attendance` `getAllowedClassIds()` cuma pakai `teacher.homeroomOf`. Halaman Absensi (`attendance/page.tsx`, `attendance/summary/page.tsx`, `attendance/[classId]/page.tsx`) panggil `/api/teacher/classes?scope=homeroom` (bukan endpoint polos) supaya daftar kelasnya juga cuma kelas wali — endpoint `/api/teacher/classes` sendiri TETAP defaultnya gabungan (dipakai halaman Nilai yg tidak berubah), `scope=homeroom` cuma opt-in dari sisi pemanggil. Absensi siswa via Ketua Kelas/Sekretaris (`/dashboard/student/absensi-kelas`) tetap ada sbg alternatif kalau wali kelas berhalangan — tabel `Attendance` yg sama, bukan modul terpisah.
    - **Jurnal Mengajar** SUDAH dari awal berbasis `TeachingAssignment` (`/api/teacher/journal-classes`), bukan `homeroomOf` — guru mapel apapun boleh isi jurnal utk kelas yg diampunya. Daftar kelas di jurnal SEKARANG difilter lagi berdasarkan jadwal (`Schedule` day+weekType) pas tanggal yg dipilih (`?date=` param) — bukan seluruh `TeachingAssignment` guru itu tanpa peduli hari.
    - **Kehadiran di Jurnal Mengajar** (kolom "Kehadiran" per pertemuan) TERPISAH TOTAL dari Absensi resmi — disimpan di `JournalEntry.attendanceStatus`, BUKAN di tabel `Attendance`. Dulu (bug lama, sudah diperbaiki) Jurnal ikut menimpa `Attendance` langsung, bikin guru mapel & wali kelas rebutan status hari yg sama (race, siapa simpan terakhir menang). Kolom Kehadiran di Jurnal murni pegangan pribadi guru mapel itu, tidak memengaruhi rekap/rapor Absensi resmi.
    - **Semua dropdown status kehadiran** (Absensi, Absensi Kelas, Buku Piket, Kehadiran Guru Piket, Jurnal Mengajar) WAJIB default KOSONG (`""`), bukan `"HADIR"` — baik di state awal React maupun fallback API (`?? ""`, bukan `?? "HADIR"`). Simpan/POST wajib validasi tidak ada yang masih kosong sebelum record ditulis (skip atau tolak). Ini keputusan eksplisit user (2026-08-08) setelah nemu bug nyata: default lama diam-diam bikin siswa/guru yg tidak dicek sama sekali kelihatan "Hadir" begitu wali kelas/Wakasek klik Simpan tanpa sadar.

11. **`Major` adalah satu-satunya sumber daftar jurusan** — JANGAN hardcode daftar jurusan (nama/kode) di halaman publik manapun. Selalu `prisma.major.findMany()` langsung di setiap tempat yang menampilkan daftar jurusan (homepage `Programs.tsx`, `/programs`, `/programs/[slug]`, `about/page.tsx`, `Footer.tsx`, form SPMB `AdmissionsForm.tsx` via `/api/public/majors`). `src/data/programs.ts` HANYA dipakai sebagai fallback ikon/warna Tailwind untuk 5 jurusan awal (TKJ/AK/ATU/DKV/DPIB) — kalau admin menambah jurusan baru lewat `/dashboard/admin/majors`, jurusan itu otomatis muncul di semua tempat tanpa perlu ubah kode, SELAMA kodenya query live dari DB.

12. **Fetch client-side wajib `.catch()`** — pola `fetch(...).then(...).then(data => { ...; setLoading(false); })` TANPA `.catch()` di akhir membuat spinner macet permanen selamanya kalau request gagal (network error, dsb). Selalu tutup chain dengan `.catch(() => {}).finally(() => setLoading(false))` (pisahkan `setLoading` dari isi `.then()` terakhir ke `.finally()`).

13. **Guard berbasis jabatan** — pola standar: buat `src/lib/<nama>-guard.ts` isinya `if (session.role === "TEACHER") await assertJabatan(session, ["Nama Jabatan"]);` (ADMIN & TAS otomatis lolos karena tidak masuk cabang `if`). Reuse pola ini kalau ada jabatan baru yang perlu akses modul tertentu — lihat `branding-guard.ts`, `uks-guard.ts`, `kedisiplinan-guard.ts`, dll sebagai contoh.

14. **Komponen manager + basePath / reuse lintas portal** — kalau sebuah fitur admin (misal Berita/Galeri/Banner) perlu juga bisa diakses guru dengan jabatan tertentu, JANGAN duplikasi kode. Ekstrak isi halaman jadi komponen di `src/components/shared/<Nama>Manager.tsx`, lalu buat wrapper tipis di kedua portal (`src/app/dashboard/admin/x/page.tsx` dan `src/app/dashboard/teacher/x/page.tsx`) yang cuma `return <XManager />`. Lihat `NewsManager`/`GalleryManager`/`BannerManager` (dipakai admin & guru Koordinator Publikasi) sebagai contoh terbaru.

15. **JANGAN generate ID unik pakai `Math.random()`/`crypto.randomUUID()` langsung di body komponen client** ("use client") yang di-render server-side (SSR) — nilainya beda antara render di server dan render di client, jadi elemen DOM yang butuh dicari lewat `document.getElementById(id)` di dalam `useEffect` TIDAK AKAN PERNAH ketemu (production React tidak memperbaiki atribut `id` yang mismatch saat hydration, beda dengan dev mode yang biasanya warning). Gejalanya diam-diam gagal: tidak ada error di console, tidak ada exception, komponen third-party (seperti ONLYOFFICE DocEditor) cuma tidak pernah render apa-apa. Kejadian nyata: `OnlyofficeEditor.tsx` awalnya pakai `useRef(`onlyoffice-${Math.random()...}`)`, diperbaiki jadi `useId()` bawaan React (didesain khusus stabil antara server & client). Selalu pakai `useId()` untuk kebutuhan ID unik semacam ini.

16. **`PageHeader` (`src/components/admin/PageHeader.tsx`) HANYA BOLEH berisi icon + judul + keterangan judul — TIDAK ADA prop `actions`, TIDAK ADA tombol/dropdown/filter apapun di dalamnya.** Ini aturan eksplisit user, sudah berkali-kali dilanggar (di-tambah lagi tiap fitur baru) makanya komponennya sendiri SENGAJA tidak lagi punya prop `actions` — kalau butuh tombol (mis. "Cetak", "Tambah Data", link ke halaman lain), taruh di `<div className="flex justify-end mb-5">...</div>` (atau grid serupa) TEPAT DI BAWAH `<PageHeader />`, bukan di dalamnya. Jangan tambah prop `actions` lagi ke `PageHeader.tsx` — kalau ada kebutuhan tombol di header, itu artinya tombolnya harus pindah ke baris terpisah, bukan komponennya yang diubah.

17. **Sidebar (`AdminSidebar`, `TasSidebar`, `TeacherSidebar`, `StudentSidebar`) — SEMUA sekarang dikelompokkan (grup + accordion), dan grup WAJIB tertutup semua di awal login/muat halaman** (kecuali grup yang memuat halaman aktif saat itu) — sengaja TIDAK ADA restore dari localStorage utk status buka/tutup grup, ini keputusan eksplisit user, jangan ditambah lagi. Pola standar tiap sidebar: `menuGroups` (array `{label, items}}`, `label: null` utk item root spt Dashboard), `ALL_HREFS` gabungan semua href utk disambiguasi prefix (`isActive`/`matchesPath` cuma anggap href PALING SPESIFIK/terpanjang yg aktif), `openGroups` (Set, satu grup aktif dalam satu waktu — accordion, bukan numpuk), `toggleGroup()`, `activeGroupLabel()` dipanggil di 2 `useEffect` (mount + tiap `pathname` berubah) supaya grup halaman yang lagi dibuka otomatis kebuka. Kalau nambah menu baru, taruh di grup yang paling sesuai (atau bikin grup baru kalau belum ada yg cocok) — JANGAN kembalikan ke daftar flat/datar.
    - **Desktop `<aside>` WAJIB `sticky top-0 h-screen shrink-0`, JANGAN `fixed top-0 left-0 bottom-0`.** `fixed` melepas sidebar dari alur dokumen sehingga elemen lain yang disisipkan SEBELUM sidebar di layout (mis. `ImpersonationBanner` pita oranye "Masuk Sebagai...") jadi ke-overlap/ketutup krn sidebar tetap nempel di y=0 viewport, bukan didorong ke bawah seperti seharusnya. `sticky` ikut alur dokumen (didorong turun oleh elemen sebelumnya) sambil tetap nempel ke atas viewport-nya-sendiri saat discroll — persis yang dibutuhkan. Kalau aside pakai `sticky`, JANGAN kasih `lg:ml-<lebar>` kompensasi di `<main>` — itu cuma perlu utk `fixed` (yg keluar dari alur, butuh margin manual). Lihat `AdminSidebar.tsx`/`TasSidebar.tsx` sbg referensi yg sudah benar dari awal.

18. **Halaman "hero"/landing tiap portal (`/dashboard/admin/page.tsx`, `/dashboard/teacher/page.tsx`, `/dashboard/student/page.tsx`) — header sapaan besarnya (gradient navy, bukan `PageHeader` biasa) WAJIB `sticky top-14 lg:top-0 z-30`** (Admin pakai `top-16` krn topbar mobile-nya beda tinggi — sesuaikan angka `top-*` dgn tinggi topbar mobile portal masing2, jangan asal `top-0` polos krn nanti ketutup topbar mobile yg `fixed z-50`) — supaya konsisten dgn `PageHeader` yang semua halaman lain sudah sticky, tidak ikut hilang pas discroll ke bawah.

19. **Tombol/link "Cetak" (halaman print apapun) JANGAN pakai `target="_blank"`** kecuali benar2 perlu tetap terbuka terus-menerus di device terpisah ATAU ada resiko nyata kehilangan draft yang belum disimpan. Dua pengecualian yg sah: `/dashboard/admin/bel-sekolah/player` (didesain dibuka permanen di PC/speaker sekolah, layar penuh, terpisah dari alur kerja admin) dan `/dashboard/admin/persuratan/[id]/edit-word` (link "Cetak" di situ sengaja tab baru supaya draft di editor WYSIWYG yang belum disimpan tidak hilang kalau tab utama pindah halaman). Cetak biasa (rekap, kalender, form, buku induk, jurnal, notulen, barcode, dsb) harus navigasi di tab yang sama — halaman cetak semuanya sudah punya tombol "Kembali"/`ArrowLeft` sendiri, tab baru cuma bikin bersliweran tanpa guna. Keputusan eksplisit user, ditegur berulang — sudah disapu bersih di seluruh app 2026-08-11 (buku-induk siswa ×2, notulen-rapat, jurnal-guru, journal guru, students/[id], perpustakaan cetak-barcode).

20. **`@media print { body { background: white !important; ... } }` di `globals.css` — JANGAN DIHAPUS.** `body` situs ini punya background dekoratif garis-garis diagonal (dipakai di seluruh dashboard) + `-webkit-print-color-adjust: exact` global dipaksa aktif saat print supaya kop/header tabel gelap ikut tercetak — tanpa override ini, tekstur diagonal itu ikut kepaksa tercetak juga di RUANG KOSONG bawah halaman terakhir kalau kontennya cuma tersisa dikit (mis. tabel 35 baris yang meluber ke halaman ke-2 tapi cuma keisi separuh). Halaman cetak baru TIDAK PERLU nambah apapun utk ini — cukup pastikan tidak menghapus/override blok itu.

21. **JANGAN ubah nilai `@page { size: A4; margin: ...; }` yang sudah ditentukan tiap halaman cetak** kecuali diminta eksplisit — tiap halaman print (`schedules/print`, `absensi-siswa/cetak-kalender`, `absensi-jurnal/cetak-kelas`, dll) punya margin sendiri yang sudah disesuaikan isi kontennya (landscape/portrait, margin sempit/lebar) — kalau nambah halaman cetak baru, boleh set margin sendiri sesuai kebutuhan konten, tapi jangan sentuh punya halaman lain yang sudah ada tanpa diminta.

22. **Wrapper `.print-doc` di halaman cetak WAJIB juga diberi `bg-white` eksplisit** (`className="print-doc bg-white ..."`), bukan cuma andalkan `.print-doc`/`.a4-page` class-nya sendiri (keduanya TIDAK otomatis kasih background putih). Tanpa `bg-white`, warna abu-abu latar dashboard (`#f0f2f7`, dipasang di tiap `layout.tsx`) keliatan tembus di balik "kertas" pas pratinjau layar — beda dari hasil cetak fisik yang sungguhan putih. Ditemukan & disapu bersih di 8 halaman cetak 2026-08-11 (cetak-kalender, rapor, journal/cetak ×2, schedules print ×4) — kalau nambah halaman cetak baru dgn wrapper `print-doc` polos (bukan yg sudah pakai `SheetShell`/`.a4-page` dgn `bg-white` bawaan spt di `absensi-jurnal/cetak-kelas`), WAJIB tambahkan `bg-white` dari awal.

23. **JANGAN PERNAH pakai `<input type="date">`/`<input type="month">` mentah dari browser** — tampilannya beda-beda tiap OS/browser (generik, tidak sesuai desain situs). WAJIB pakai `<DatePicker value={} onChange={} />` (`src/components/shared/DatePicker.tsx`, format value `"YYYY-MM-DD"`) atau `<MonthPicker value={} onChange={} />` (`src/components/shared/MonthPicker.tsx`, format value `"YYYY-MM"`) — keduanya custom popup kalender bergaya situs (bukan native), `onChange` menerima string langsung (bukan event `e.target.value`). Untuk form yang sudah pakai komponen `Field` (`src/components/admin/BukuIndukField.tsx`, dipakai Buku Induk/Biodata) — itu SUDAH otomatis render `DatePicker` kalau `type="date"`, tidak perlu diubah. Disapu bersih di 11 halaman/komponen 2026-08-11 — jangan tambah input tanggal/bulan mentah lagi di fitur baru manapun.

24. **JANGAN PERNAH bungkus `<PageHeader />` sendirian di dalam `<div className="print:hidden">`** — root cause bug nyata 2026-08-12 (temuan user: "header masih bisa scroll dan hilang" di halaman Poin Siswa, terverifikasi pakai Playwright headless bukan cuma baca kode). Penyebabnya: `position: sticky` butuh "ruang gerak" scroll DI DALAM parent langsungnya — kalau parent div itu HANYA berisi header (tidak ada elemen lain), tinggi parent jadi persis sama dengan tinggi header, jadi sticky tidak punya ruang sama sekali untuk "nempel" dan header ikut ke-scroll hilang seperti `position: static` biasa (walau `getComputedStyle` tetap bilang `position: sticky` — jangan percaya itu saja, harus dites scroll sungguhan). PageHeader sekarang punya prop `printHidden` (boolean) yang menambahkan `print:hidden` LANGSUNG ke elemen `<header>` itu sendiri — pakai itu, JANGAN bungkus dengan div terpisah lagi:
    ```tsx
    // SALAH — merusak sticky:
    <div className="print:hidden"><PageHeader icon={...} title="..." /></div>
    // BENAR:
    <PageHeader icon={...} title="..." printHidden />
    ```
    Disapu bersih di 8 halaman/komponen (rapor, buku-mutasi, reports/rekap-siswa, TataTertibViewer, classes/cetak, StudentPointsManager, DknTable, KartuTandaSheet) — kalau nambah PageHeader baru yang butuh disembunyikan saat print, pakai prop `printHidden`, bukan wrapper div.
