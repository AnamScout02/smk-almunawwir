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

**Sistem sesi DUA TOKEN (sejak 14 September 2026)** — menggantikan JWT tunggal 8 jam yang
di-sign ulang tiap request:

| Cookie | Isi | Umur |
|---|---|---|
| `session` | **Token akses** — JWT berisi `userId/role/name/email` + `sid` (id baris `UserSession`) + `imp` (admin asli saat "Masuk Sebagai") | 15 menit (klaim `exp`); cookie sesi browser |
| `sesi_segar` | **Token segar** — 256 bit acak; DB hanya menyimpan hash SHA-256 di `UserSession.tokenHash` | "Ingat saya" off: cookie sesi browser + habis **8 jam sejak aktif terakhir** (bawaan — keputusan lama user, komputer TU/lab dipakai bergantian). On: 30 hari bergeser |

```
src/lib/session.ts      ← token & cookie: encrypt/decrypt, getSession, opsi cookie, 2FA pending
src/lib/sesi-server.ts  ← semua yang menyentuh tabel UserSession: masukkanSesi (login), segarkanSesi,
                          sesiMasihHidup, cabutSesi/cabutSemuaSesiPengguna, keluarkanSesiIni (logout),
                          mulaiMasukSebagai/akhiriMasukSebagai, migrasiTokenLama
src/lib/dal.ts          ← verifySession(): token akses + CEK BARIS UserSession masih hidup (1 query PK
                          per request, di-cache) → pencabutan/sesi tunggal/logout perangkat lain INSTAN
src/proxy.ts            ← token akses habis + ada token segar → terbitkan yang baru DIAM-DIAM dan
                          teruskan ke request yang sama (padanan silent refresh, berlaku untuk RSC)
```

Aturan yang wajib dijaga:
- **Jangan menambahkan rotasi token segar.** Dashboard memuat banyak request paralel; saat token
  akses habis semuanya membawa token segar yang sama — dengan rotasi, semua kecuali satu ditolak
  dan pengguna "logout sendiri".
- **Jangan paksa `Secure=true`, dan jangan jadikan setelan global.** Situs dibuka dua jalur sekaligus:
  HTTP langsung di jaringan sekolah dan HTTPS lewat terowongan Tailscale Funnel. `pakaiSecure(headers)`
  memutuskan PER REQUEST dari `X-Forwarded-Proto` (cadangan: `NEXT_PUBLIC_APP_URL`) — cookie Secure di
  jalur HTTP ditolak browser dan tidak ada yang bisa login. Setiap tempat yang memasang cookie sesi WAJIB
  meneruskan header request: `opsiCookieAkses(h)` / `opsiCookieSegar(ingat, h)` (di proxy `req.headers`,
  di server action/route `await headers()`).
- **Ganti/reset password WAJIB `cabutSemuaSesiPengguna(userId, "GANTI_PASSWORD")`** (ganti sendiri:
  kecuali `session.sid`). Sudah dipasang di profile/password, admin/users/[id], parents reset,
  buku-induk guru/[id] & siswa/[id] — endpoint baru yang mengubah password juga harus begitu.
- "Masuk Sebagai" TIDAK lagi memakai cookie `impersonator`: baris sesi admin ditandai
  `impersonatingUserId`, token akses membawa `imp`. `logActivity` otomatis mengisi
  `impersonatorName`. Token lama tanpa `sid` dipindahkan otomatis oleh proxy (tanpa login ulang).
- Kebijakan "satu akun satu perangkat" per peran: SiteSetting `auth.sesiTunggal` (JSON array),
  diatur di `/dashboard/admin/keamanan-sesi`. Perangkat aktif tiap akun: kartu `PerangkatAktif`
  di halaman Profil. `PenjagaSesiTab` (dipasang di `Providers`) menutup tab yang akunnya berganti
  di tab lain.

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

### Export data → Excel (.xlsx), BUKAN CSV
**JANGAN membuat endpoint ekspor CSV baru.** Excel versi Indonesia memakai titik-koma sebagai
pemisah kolom sedangkan CSV kita memakai koma — akibatnya berkas yang dibuka lewat klik dua kali
menumpuk seluruh data di SATU kolom, dan petugas harus lewat wizard "Text to Columns" tiap kali
(keputusan eksplisit user 13 September 2026: "mending excel biasa, jadi tidak satu kolom untuk
banyak data"). Semua 9 endpoint ekspor lama sudah dipindah ke .xlsx.

Pakai helper `src/lib/ekspor-excel.ts` — sudah mengurus lebar kolom otomatis, saringan per kolom,
nama sheet yang sah (maks 31 karakter, tanpa `: \ / ? * [ ]`), dan header unduhan:
```ts
import { balasanExcel } from "@/lib/ekspor-excel";
return balasanExcel({ namaFile: "data-siswa-2026-09-13", namaSheet: "Data Siswa", headers, rows });
// beberapa tabel dalam satu berkas:
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
return balasanExcelBanyakSheet("pemeriksa-data", [{ nama: "Ringkasan", headers, rows }, { nama: "Rincian", ... }]);
```
`rows` adalah array of array (`SelBaris`). **Biarkan angka tetap bertipe number** — jangan
`String(v)` seperti pola CSV lama, supaya di Excel bisa langsung dijumlah/dirata-rata. BOM UTF-8
tidak lagi diperlukan (xlsx sudah Unicode).

Merakit berkas Excel di sisi KLIEN juga dihindari — pustaka `xlsx` terlalu berat untuk bundel
browser. Kalau tombol unduh ada di client component, buat endpoint-nya lalu pakai `<a href>` biasa
(lihat `PemeriksaDataManager` → `/api/admin/pemeriksa-data/ekspor`).

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

13. **Guard berbasis jabatan** — pola standar: buat `src/lib/<nama>-guard.ts` isinya `if (session.role === "TEACHER") await assertJabatan(session, ["Nama Jabatan"]);` (ADMIN & TAS otomatis lolos karena tidak masuk cabang `if`). Reuse pola ini kalau ada jabatan baru yang perlu akses modul tertentu — lihat `branding-guard.ts`, `uks-guard.ts`, `kedisiplinan-guard.ts`, dll sebagai contoh. **Di HALAMAN server (page.tsx), bungkus penjaga dengan `jabatanAtauAlihkan(session, () => assertXxx(session))`** (src/lib/jabatan-guard.ts) — `assertJabatan` melempar `FORBIDDEN` yang di route API menjadi 403, tetapi di halaman server tidak tertangkap dan pengguna tanpa jabatan melihat 500 (temuan 15 Sep 2026).

14. **Komponen manager + basePath / reuse lintas portal** — kalau sebuah fitur admin (misal Berita/Galeri/Banner) perlu juga bisa diakses guru dengan jabatan tertentu, JANGAN duplikasi kode. Ekstrak isi halaman jadi komponen di `src/components/shared/<Nama>Manager.tsx`, lalu buat wrapper tipis di kedua portal (`src/app/dashboard/admin/x/page.tsx` dan `src/app/dashboard/teacher/x/page.tsx`) yang cuma `return <XManager />`. Lihat `NewsManager`/`GalleryManager`/`BannerManager` (dipakai admin & guru Koordinator Publikasi) sebagai contoh terbaru.

15. **JANGAN generate ID unik pakai `Math.random()`/`crypto.randomUUID()` langsung di body komponen client** ("use client") yang di-render server-side (SSR) — nilainya beda antara render di server dan render di client, jadi elemen DOM yang butuh dicari lewat `document.getElementById(id)` di dalam `useEffect` TIDAK AKAN PERNAH ketemu (production React tidak memperbaiki atribut `id` yang mismatch saat hydration, beda dengan dev mode yang biasanya warning). Gejalanya diam-diam gagal: tidak ada error di console, tidak ada exception, komponen third-party (seperti ONLYOFFICE DocEditor) cuma tidak pernah render apa-apa. Kejadian nyata: `OnlyofficeEditor.tsx` awalnya pakai `useRef(`onlyoffice-${Math.random()...}`)`, diperbaiki jadi `useId()` bawaan React (didesain khusus stabil antara server & client). Selalu pakai `useId()` untuk kebutuhan ID unik semacam ini.

16. **`PageHeader` (`src/components/admin/PageHeader.tsx`) HANYA BOLEH berisi icon + judul + keterangan judul — TIDAK ADA prop `actions`, TIDAK ADA tombol/dropdown/filter apapun di dalamnya.** Ini aturan eksplisit user, sudah berkali-kali dilanggar (di-tambah lagi tiap fitur baru) makanya komponennya sendiri SENGAJA tidak lagi punya prop `actions` — kalau butuh tombol (mis. "Cetak", "Tambah Data", link ke halaman lain), taruh di `<div className="flex justify-end mb-5">...</div>` (atau grid serupa) TEPAT DI BAWAH `<PageHeader />`, bukan di dalamnya. Jangan tambah prop `actions` lagi ke `PageHeader.tsx` — kalau ada kebutuhan tombol di header, itu artinya tombolnya harus pindah ke baris terpisah, bukan komponennya yang diubah.

17. **Sidebar (`AdminSidebar`, `TasSidebar`, `TeacherSidebar`, `StudentSidebar`) — SEMUA sekarang dikelompokkan (grup + accordion), dan grup WAJIB tertutup semua di awal login/muat halaman** (kecuali grup yang memuat halaman aktif saat itu) — sengaja TIDAK ADA restore dari localStorage utk status buka/tutup grup, ini keputusan eksplisit user, jangan ditambah lagi. Pola standar tiap sidebar: `menuGroups` (array `{label, items}}`, `label: null` utk item root spt Dashboard), `ALL_HREFS` gabungan semua href utk disambiguasi prefix (`isActive`/`matchesPath` cuma anggap href PALING SPESIFIK/terpanjang yg aktif), `openGroups` (Set, satu grup aktif dalam satu waktu — accordion, bukan numpuk), `toggleGroup()`, `activeGroupLabel()` dipanggil di 2 `useEffect` (mount + tiap `pathname` berubah) supaya grup halaman yang lagi dibuka otomatis kebuka. Kalau nambah menu baru, taruh di grup yang paling sesuai (atau bikin grup baru kalau belum ada yg cocok) — JANGAN kembalikan ke daftar flat/datar.
    - **Desktop `<aside>` WAJIB `sticky top-0 h-screen shrink-0`, JANGAN `fixed top-0 left-0 bottom-0`.** `fixed` melepas sidebar dari alur dokumen sehingga elemen lain yang disisipkan SEBELUM sidebar di layout (mis. `ImpersonationBanner` pita oranye "Masuk Sebagai...") jadi ke-overlap/ketutup krn sidebar tetap nempel di y=0 viewport, bukan didorong ke bawah seperti seharusnya. `sticky` ikut alur dokumen (didorong turun oleh elemen sebelumnya) sambil tetap nempel ke atas viewport-nya-sendiri saat discroll — persis yang dibutuhkan. Kalau aside pakai `sticky`, JANGAN kasih `lg:ml-<lebar>` kompensasi di `<main>` — itu cuma perlu utk `fixed` (yg keluar dari alur, butuh margin manual). Lihat `AdminSidebar.tsx`/`TasSidebar.tsx` sbg referensi yg sudah benar dari awal.

18. **(DIBALIK 2026-08-23 — lihat DESIGN_SYSTEM.md §3.3)** Halaman landing tiap portal (`/dashboard/admin/page.tsx`, `/dashboard/teacher/page.tsx`, `/dashboard/student/page.tsx`) DULU punya header "hero" custom (gradient navy manual, `sticky top-14 lg:top-0 z-30`, Admin pakai `top-16`) — SEKARANG WAJIB pakai `<PageHeader>` standar yang sama persis dengan semua halaman fitur lain (keputusan eksplisit user: header dashboard "keliatan tidak sama seperti halaman lain"). Jangan bikin blok header custom lagi di 3 halaman ini — sapaan/tanggal/identitas taruh di prop `description`, bukan blok terpisah.

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

25. **Saat mencetak, varian `lg:` TIDAK berlaku — halaman dilayout selebar KERTAS, bukan selebar layar.** A4 portrait = 210mm = 794px CSS, dan itu ADA DI BAWAH breakpoint `lg` (1024px). Jadi semua peredam bergaya `lg:pb-0`, `lg:pt-0`, `lg:hidden` diam-diam mati saat print, dan yang berlaku justru nilai dasarnya (versi mobile). Kejadian nyata 13 September 2026: `<main>` tiap portal punya `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0` (ruang untuk `MobileBottomNav`) — 64px = 16,9mm itu ikut tercetak persis setelah lembar terakhir dan melahirkan **satu halaman kosong di akhir SETIAP cetakan surat**. Gejalanya menipu: kelihatan seperti lembar `.a4-page` yang meluber, sempat "diperbaiki" dengan mengecilkan `min-height` sampai 280mm (menutupi gejala + bikin kop bawah berhenti 17mm dari tepi kertas), padahal lembarnya memang muat 297mm penuh. Aturannya: setiap peredam khusus layar yang mengambil RUANG (padding/margin/tinggi) wajib punya pasangan `print:` sendiri (`print:pt-0 print:pb-0`), jangan mengandalkan `lg:`. Untuk sekadar menyembunyikan elemen, `print:hidden` memang sudah benar — yang berbahaya cuma yang menyisakan ruang. Cara memeriksanya juga penting: ukur dengan `page.pdf({ preferCSSPageSize: true })` lalu HITUNG halamannya, bukan `emulateMedia({media:"print"})` di viewport lebar — viewport lebar justru menyembunyikan bug ini karena `lg:` jadi aktif.

26. **`route.ts` HANYA boleh mengekspor handler HTTP (`GET`/`POST`/…) dan konfigurasi (`dynamic`, `revalidate`, dsb).** Mengekspor fungsi/tipe pembantu dari `route.ts` (mis. `export function siapkanButir`) membuat `next build` GAGAL dengan pesan "is not a valid Route export field". Taruh pembantu bersama di `src/lib/<nama>.ts` dan impor dari sana — pola nyata: `src/lib/soal-butir-server.ts` & `src/lib/ujian-pengaturan.ts` (dipisah dari route CBT, 13 September 2026).


27. **Satu ujian CBT boleh diikuti BANYAK kelas (`Exam.kelasIds`, sejak 14 September 2026).** `Exam.classId` tinggal
    "kelas utama" untuk tampilan/kompatibilitas — **JANGAN dipakai untuk menyaring peserta.** Pakai helper di
    `src/lib/ujian-server.ts`: `kelasPeserta(exam)` (daftar kelas), `ujianUntukKelas(classId)` (filter Prisma ujian
    yang diikuti sebuah kelas), `petaNamaKelas(exams)` (nama kelas banyak ujian, 1 query), `jumlahSiswaAktif(ids)`.
    Akses guru di `ujianDalamCakupan(session, id, { ubah })`: **pembuat** boleh semua; **pengampu** (mengajar mapel
    yang sama di salah satu kelas peserta) boleh memantau/koreksi/hasil tapi TIDAK boleh mengubah — route yang
    mengubah soal/pengaturan/menghapus WAJIB memanggil dengan `{ ubah: true }`. Kelas peserta divalidasi
    `periksaKelasPeserta` (guru hanya kelas yang ia ampu; kelas yang siswanya sudah mengerjakan tidak bisa dilepas).
    Kode Test (Excel) & Mata Pelajaran (Word) dicocokkan ke mapel ujian dengan `cocokMapel` (`src/lib/cocok-mapel.ts`):
    BEDA ditolak saat menerapkan Excel ke ujian, singkatan wajar (PJOK, "Pendidikan Agama Islam") diterima dgn catatan.
28. **JANGAN memanggil `navigator.clipboard` langsung — pakai `salinTeks(teks)` dari `src/lib/salin-teks.ts`.**
    Clipboard API hanya ada di *secure context* (HTTPS/localhost). Server sekolah dibuka lewat
    `http://<IP-PUBLIK-SERVER>:3000`, jadi `navigator.clipboard` = `undefined`: pola `navigator.clipboard?.writeText(x)`
    gagal DIAM-DIAM sementara toast "disalin" tetap tampil — token terlihat tersalin tapi saat ditempel kosong
    (temuan user 14 Sep 2026, di 3 tombol salin token + tombol kode cadangan 2FA yang malah error). `salinTeks`
    memakai Clipboard API bila tersedia, lalu cadangan textarea + `execCommand("copy")`, dan mengembalikan
    `true` HANYA kalau benar tersalin — toast berhasil/gagal wajib mengikuti hasil itu. **Mengujinya jangan lewat
    `localhost`** (dianggap secure context, bug-nya tersembunyi); pakai IP jaringan server, mis. `http://<IP-SERVER>:3000`.

29. **Ikon aplikasi terpasang (PWA) dibangkitkan dari Logo Lambang (`logo.emblem`), bukan gambar statis.**
    `src/lib/ikon-aplikasi.ts` + route `/ikon-aplikasi/[berkas]` (any-192/512 transparan, maskable-192/512 & apple-180
    = logo di zona aman di atas warna tepi logo). `src/app/manifest.ts` WAJIB `export const dynamic = "force-dynamic"` —
    metadata route di-cache statis saat build, dan tanpa itu versi ikon (`?v=`) membeku. `public/icons/*` hanya
    cadangan; kalau gambar di `/icons` atau `/images` diganti di tempat, NAIKKAN `CACHE_NAME` di `public/sw.js` (cache-first).
    Pemasangan hanya jalan lewat HTTPS (`ALAMAT_APLIKASI` di `src/lib/alamat-aplikasi.ts` — ganti saat domain sekolah
    aktif). Tawaran pasang browser ditangkap sedini mungkin di `src/lib/pasang-pwa.ts` (event `beforeinstallprompt` sering
    datang sebelum hydrate) — komponen baru berlangganan ke sana, JANGAN memasang pendengar sendiri di useEffect.
    Halaman yang dibagikan ke WA: `/pasang-aplikasi` (juga memuat unduhan APK Android sejak 23 Sep 2026). Uji: `Page.getInstallabilityErrors` lewat CDP harus kosong.
30. **Papan pantau ujian = Server-Sent Events** (`/api/teacher/exams/[id]/pantau/stream`, isi dari `susunPapanPantau` di
    `src/lib/pantau-ujian.ts`, sama dengan GET `/pantau`). Klien WAJIB lewat hook `usePantauLangsung` (otomatis kembali ke
    polling 5 detik bila stream gagal; `sisa(sisaDetik)` untuk hitung mundur). Respons stream WAJIB
    `Cache-Control: no-cache, no-transform` — tanpa `no-transform` kompresi menahan potongan stream. Terbukti 14 Sep 2026:
    kiriman pertama ±0,5 dtk (HTTPS terowongan) / ±0,2 dtk (HTTP lab), kiriman berkala ±15 dtk tidak tertahan.

31. **Notifikasi push: selalu lewat `kirimNotifikasi` (src/lib/push-server.ts) dengan `kunci` stabil.** Satu kunci hanya
    pernah terkirim sekali (tabel `NotifikasiTerkirim`), jadi aman dari simpan ulang & penjadwal. Dari route API panggil
    `kirimLatar(() => …)` SETELAH data tersimpan — push tidak boleh memperlambat atau menggagalkan simpan. Notifikasi
    kejadian ada di `src/lib/notifikasi-kejadian.ts` (alpha → orang tua, alpha 3 hari beruntun → wali & BK, poin → orang
    tua, tugas baru → siswa); pengingat berjam di `src/lib/pengingat-terjadwal.ts` (dijalankan `instrumentation.ts` tiap 5
    menit; jam di SiteSetting `notifikasi.*`, diatur admin di /dashboard/admin/notifikasi). Setiap pengingat baru WAJIB
    menerima parameter `kirim` supaya ikut di **Pratinjau** (mode kering, tanpa mengirim). Keluar (logout) → `/login?keluar=1`
    melepas langganan perangkat itu. Kunci VAPID di `.env` JANGAN dibuat ulang: semua langganan terikat ke kunci itu. Setiap kiriman JUGA masuk **kotak
    notifikasi** akun (`NotifikasiPengguna`; lonceng di bar atas mobile & tombol melayang desktop) — sampai ke semua akun
    walau push belum diaktifkan (keputusan user: aktivasi per perangkat tidak bisa dipaksa dari superadmin). **Pita "Tugas
    Hari Ini" sudah DIHAPUS** (15 Sep 2026: isinya sama dengan kotak notifikasi → dobel & memakan ruang HP) — jangan
    dimunculkan lagi. `src/lib/tugas-hari-ini.ts` tetap dipakai untuk menandai pengingat yang tugasnya sudah selesai.
    **Pengingat berulang sehari (absensi/piket/jurnal/peringatan dini) WAJIB `gantiHariIni: true`**: entri kotak dengan jenis +
    judul sama di hari itu diganti yang terbaru, bukan menumpuk (temuan user 15 Sep 2026: "notifikasi dobel dimana-mana").
    Pengingat yang tugasnya sudah dikerjakan otomatis ditandai dibaca (`tandaiPengingatSelesai`, src/lib/kotak-notifikasi.ts,
    dipanggil /api/notifikasi & /ringkas). Jangan menambah kartu/pita pengingat di halaman untuk hal yang sudah ada di kotak notifikasi.
    **Kunci notifikasi KEJADIAN yang bisa dipicu simpan massal (mis. absensi beberapa hari sekaligus) memakai HARI KIRIM per
    sasaran, bukan tanggal datanya** — `alpha-beruntun:<siswa>:<hari WIB>`. Dengan kunci per tanggal data, satu simpan
    mengirim "alpha 10, 11, … 19 hari berturut-turut" ke penerima yang sama (temuan user 15 Sep 2026).
32. **Peringatan dini siswa = satu sumber: `hitungRisikoSiswa` (src/lib/peringatan-dini.ts).** Dipakai Dashboard BK,
    /dashboard/teacher/peringatan-dini (wali kelas: kelas walinya saja; Guru BK & Wakasek Kesiswaan: semua), admin, notifikasi
    alpha beruntun, dan ringkasan Senin. Ubah bobot/ambang HANYA di file itu (dan teks penjelas di PeringatanDiniManager).
33. **Absensi lewat pindai tidak pernah menimpa isian wali kelas** — scan kartu (/api/admin/absensi-scan) & absen mandiri QR
    (/api/student/absen-mandiri) hanya mengisi HADIR bila hari itu belum ada catatan, dan setiap pindaian dicatat di
    `AbsensiPindaiLog` (metode, perangkat, hasil). QR mandiri = token HMAC berganti tiap 30 detik (`src/lib/absensi-qr.ts`),
    berlaku ±1 menit. Pemindai kamera bersama: `usePindaiKamera` (src/lib/pindai-kamera.ts — BarcodeDetector, cadangan
    `jsqr`), hanya jalan di HTTPS.
34. **Perpustakaan punya dua portal di luar /dashboard (pola Pusat Ujian):** `/pusat-perpustakaan` (petugas: Koordinator/Tim
    Perpustakaan & admin — meja sirkulasi, kiosk kunjungan, katalog & data = `PerpustakaanManager` lama, laporan) dan
    `/perpustakaan` (anggota: katalog & pesan, pinjaman, kartu anggota digital). Kartu anggota = kartu tanda sekolah
    (NIS/NIP/awalan email pegawai), dicocokkan di server lewat `cariAnggota` (src/lib/perpustakaan-server.ts) — jangan
    memuat daftar seluruh anggota ke browser untuk mencocokkan kartu.
35. **Halaman server (tanpa "use client") yang mengoper ikon lucide ke client component: setiap ikon dipakai SEKALI saja
    di halaman itu** — termasuk pemakaian lain di `<Link>`, `EmptyState`, atau judul kartu. Di build produksi (Next 16.2.9
    Turbopack, lucide-react 1.21) ikon kembar membuat SSR gagal "Element type is invalid … but got: object" → halaman 500,
    padahal `next dev` normal dan tsc lolos. Dibuktikan 14 Sep 2026 lewat 5 build produksi lokal (beranda Pusat Perpustakaan):
    `<StatTile icon={<Wallet />}>` ×2 → 500; satu kembaran kartu+Link atau kartu+EmptyState → 200, tetapi DUA kembaran
    sekaligus → 500; semua ikon unik → 200. Jangan menggantungkan diri pada batas "satu kembaran masih lolos" — buat semua unik.
    Galat yang hanya muncul di produksi jangan ditebak dari kode: salin proyek ke scratchpad (hardlink `node_modules`, tanpa
    `instrumentation.ts`), buat halaman diagnosa per bagian, `next build` + `next start -p 3999 -H 127.0.0.1`, bandingkan,
    lalu hapus salinannya (berisi `.env`).
    **Akar yang terbukti 15 Sep 2026 (Pola tampilan v2):** di lucide-react 1.x komponen dasar `Icon` bertanda `"use client"`,
    jadi setiap ikon di halaman server adalah RUJUKAN KLIEN. Mengoper elemen itu KE DALAM komponen klien lain (`<StatTile
    icon={<Users />}>`, `<Link><Printer /></Link>`) membuat rujukan klien bertumpuk yang di build produksi bisa gagal diurai →
    500 "Element type is invalid … got: object". Pemicunya bergeser oleh perubahan kecil APA PUN (itu sebabnya batas "satu
    kembaran lolos" di atas tidak konsisten): `/dashboard/admin` v2 500; bisect di build lokal (layout Admin + DB asli) → tanpa
    ikon header 200, tanpa ikon kartu 200, tanpa tautan kartu 200, keterangan header teks polos 200; menghapus ikon kembar,
    cabang TAS, atau verifyRole TETAP 500. **Aturan:** halaman server TIDAK mengoper elemen ikon lucide ke komponen klien —
    kirim NAMA ikon: `StatTile ikon="siswa"`, `TautanIkon`/`TautanCepat`/`KartuTautan` (src/components/shared/IkonNama.tsx,
    tambahkan nama baru di peta `IKON`). Ikon di markup server murni (PageHeader, Panel, span) tetap boleh, masing-masing sekali.
    Periksa sebelum build: **`node scripts/cek-ikon-kembar.mjs <berkas yang diubah>`** (menandai ikon kembar & elemen lucide yang
    dioper sebagai prop). Reproduksi galat yang butuh layout/sesi: build lokal di scratchpad dengan `DATABASE_URL` diarahkan ke IP
    kontainer postgres + sesi uji (`sesi_segar`, header `x-forwarded-proto: https`); hentikan server lewat PID dari `ss -ltnp`.
36. **Denah ruang & kisi-kisi ujian (14 Sep 2026).** Nomor peserta HANYA dari `nomorPeserta()` (src/lib/denah-ruang.ts) —
    dipakai kartu peserta, denah, kartu meja; jangan merakit format `SINGKATAN-KELAS-NN` di tempat lain, nanti nomor di kartu
    dan di pintu ruang berbeda. Pembagian ruang disimpan per kegiatan (`PenempatanRuangUjian`, unik per siswa & per kursi),
    diatur `bolehAturUjian`, dikelola di /pusat-ujian/administrasi/ruang (cetak denah pintu, kartu meja, rekap). Kolom
    kisi-kisi soal (`materi`, `indikator`, `levelKognitif`) WAJIB ikut di SETIAP jalur yang membuat/menyalin soal
    (`siapkanButir`, POST/PUT ujian, bank soal, impor Excel) — PUT ujian menghapus & membuat ulang semua soal, jadi kolom
    yang lupa dibawa hilang diam-diam. Isian dari /pusat-ujian/[id]/kisi-kisi lewat API sendiri yang hanya mengubah kolom
    kisi-kisi (boleh setelah ujian dikerjakan, tidak menyentuh penilaian).
    Pola tempat duduk (`bagiPeserta`): SELANG_SELING (tingkat bergantian, kelas di dalam tingkat juga bergantian, sebaran
    rata — bukan giliran polos yang menumpukkan sisa tingkat terbanyak di kursi terakhir), SELANG_SELING_JURUSAN (satu ruang
    satu jurusan, siswanya dibagi rata ke ruang yang dipakai jurusan itu; 21 Sep 2026), PER_KELAS.
37. **Daftar panjang WAJIB berpagination lewat komponen bersama** — `usePaginasi(items, perHalaman, kunciReset)`
    (src/lib/use-paginasi.ts) + `<Paginasi hal={hal} satuan="…" />` (src/components/shared/Paginasi.tsx), permintaan user
    14 Sep 2026. Dipasang di Akun Pengguna, Kelola Siswa (per tabel kelas), Orang Tua, Agenda Surat, Perpustakaan (katalog,
    peminjaman, reservasi, riwayat), Katalog Anggota, Buku Saya. `kunciReset` = kata cari/saringan supaya kembali ke
    halaman 1; nomor urut baris pakai `hal.awal + i`. JANGAN racik tombol Sebelumnya/Berikutnya sendiri lagi.
    **`PageHeader` menempel di `top: var(--pageheader-top, 0px)`** dengan padding atas HP `var(--pageheader-pt, 4.5rem)`.
    Di dalam portal (`PortalShell`) kepala portal (bar navy) MENEMPEL dalam `#kepala-portal`; tingginya diukur
    `UkurKepalaPortal` → `--tinggi-kepala-portal` dan dipakai sebagai `--pageheader-top`. **Pita menu tab portal (`PitaPortal`)
    ada DI BAWAH PageHeader** (21 Sep 2026: header navy di atas pita) — PageHeader merendernya sendiri dari konteks yang dipasang
    PortalShell (`menu`), dan pita menempel tepat di bawah header dengan mengukur tinggi header itu. Jangan menebak tinggi dengan
    angka tetap, dan jangan menaikkan z-index untuk menutupi masalah tumpukan.
38. **Dapodik: data TU di situs = ACUAN, Dapodik yang disamakan (keputusan user 14 Sep 2026).** Situs hanya MEMBACA
    Dapodik lewat `panggilDapodik` (src/lib/dapodik.ts); JANGAN membuat tombol yang menyalin data Dapodik ke data situs —
    kolom yang kosong di TU cukup ditandai "data TU belum lengkap" untuk dilengkapi TU dari berkas aslinya. Perbandingan di
    `src/lib/dapodik-sinkron.ts` menghasilkan daftar untuk operator Dapodik (perlu diperbaiki / belum ada di Dapodik / tidak
    ada di TU / sudah lulus-keluar di TU), bisa diunduh .xlsx (`/api/admin/dapodik/ekspor`). Pasangan bertingkat (siswa
    NISN → NIK → NIS=NIPD → nama+tgl lahir → nama saja; GTK NIK → NUPTK → NIP → nama tanpa gelar), nilai wajib TUNGGAL di
    kedua sisi; tingkat kelas hanya dibandingkan bila semester Dapodik = tahun ajaran aktif TU. Kunci `DAPODIK_KEY` hanya di
    header Authorization — jangan dicetak, jangan mencoba variasi kunci. `rows` getSekolah = OBJEK, endpoint daftar = ARRAY;
    penolakan bisa teks polos "Access denied" dengan HTTP 200. Tiga daftar WAJIB diminta BERURUTAN — diminta serentak,
    Dapodik membalas halaman galat HTML (terbukti 15 Sep 2026). Komputer Dapodik (sejak 16 Sep 2026 PC biasa <IP-PC-DAPODIK>, dulu VM <IP-PC-DAPODIK-LAMA>) hanya menjawab saat
    menyala, Windows login, dan aplikasi Dapodik dibuka & login; **alamat Dapodik & IP server situs diubah Administrator lewat tombol Ubah**
    (SiteSetting `dapodik.alamat`/`dapodik.ipServer`, kosong = `.env`; hanya IPv4 jaringan lokal karena kunci ikut terkirim). MikroTik
    me-masquerade semua lalu lintas ke <JARINGAN-DAPODIK>, jadi Dapodik melihat IP MikroTik — bukan <IP-SERVER>. Firewall Windows PC itu
    sempat punya aturan BLOKIR "Apache HTTP Server" (profil Public) yang mengalahkan aturan izin port 5774; bila tidak, halaman menampilkan petunjuk — fitur situs lain tidak
    bergantung padanya. Saat menguji, cetak angka saja.
39. **Setiap isian Konten Halaman (`ContentEditor`) WAJIB benar-benar dibaca halaman, dan `hint`-nya menyebut letak tampilnya.**
    Temuan user 15 Sep 2026: mengganti "Kutipan 1" tidak mengubah beranda, karena beranda memakai Kutipan 2 dan ayat Login
    tertulis mati di kode. Peta sekarang: Kutipan 1 = Tentang Kami, Kutipan 2 = Beranda, Kutipan 3 = cadangan; ayat Login =
    `islamic.login_arabic/_label` lewat pembungkus server `src/app/login/page.tsx` (isi klien di `LoginClient.tsx`);
    `school.tagline/hero_subtitle` = slide pertama beranda selama belum ada Banner; kartu Keunggulan = `why.*`. Teks bahasa
    Indonesia dari pengaturan, bahasa Inggris dari `translations.ts`. Kalau menambah isian baru, pastikan ada pembacanya
    (sapuan: kunci di DEFAULTS yang hanya muncul di editor = isian mati). Header halaman publik baru: `pt-28 pb-16` seperti
    Berita/Galeri — navbar menempel menutupi header yang hanya `py-16` (kasus halaman Agenda).
40. **Hari libur = satu sumber: `cekLibur` / `daftarLibur` (src/lib/hari-libur.ts).** Libur bila: agenda Kalender Pendidikan
    bersifat LIBUR (jenis LIBUR / kode LHB, LU, LS1, LS2, CB, LHR), tanggal merah nasional (kalender libur Indonesia Google,
    hanya "Hari libur nasional", disalin ke SiteSetting `libur.nasional` & diperbarui mingguan oleh penjadwal pengingat;
    sakelar `notifikasi.liburNasional`), libur tambahan manual (`notifikasi.tanggalLibur`), atau hari Minggu. Dipakai
    pengingat terjadwal, penanda pengingat selesai (tugas-hari-ini), absen mandiri QR, dan badge "kelas belum absen". Fitur baru yang harus diam di
    hari libur WAJIB memanggil `cekLibur`, jangan mengecek Minggu/daftar manual sendiri (permintaan user 15 Sep 2026).
41. **Halaman publik WAJIB dua bahasa untuk teks antarmuka.** Bahasa dari cookie `lang` lewat `getLang()` (server); komponen
    klien menerima prop `lang`. Pola: objek `TEKS = { id: {...}, en: {...} }` per halaman/komponen, atau `translations.ts`.
    `Navbar` membaca cookie di server dan mengoper `langAwal` ke `NavbarClient` — jangan kembali memulai state bahasa dari
    `"id"` lalu membaca localStorage (menu sempat tetap Beranda/Tentang di mode Inggris, audit 15 Sep 2026). Nilai yang juga
    menjadi data/filter (kategori berita, jalur pendaftaran) tetap bahasa Indonesia — hanya LABEL-nya diterjemahkan. Isi dari
    database (jurusan, berita, galeri, agenda, struktur organisasi) memang hanya berbahasa Indonesia sampai ada kolom versi Inggris.
42. **Pola tampilan v2 (15 Sep 2026) — lihat DESIGN_SYSTEM.md §17.** Dashboard kelima portal & halaman Masuk sudah memakai
    `Panel`, `StatTile tampilan="lembut"`, `GrafikRingkas`, `JadwalHariIni`/`JadwalMingguan`; halaman lain dipindahkan bertahap
    dengan pola yang sama (jangan racik gaya kartu baru). Server berjalan di **UTC**: setiap "hari ini/tanggal/bulan ini" di
    halaman server WAJIB dihitung di WIB (`Date.now() + 7 jam` + `getUTC*`, atau `timeZone: "Asia/Jakarta"`) — pola lama
    `now.getDay()` menampilkan hari kemarin antara pukul 00.00–07.00 WIB.
    **Putaran 15 Sep 2026 (sore):** grup menu kelima portal disusun per ALUR KERJA (DESIGN_SYSTEM §3.7); portal di luar /dashboard
    (Perpustakaan, Pusat Ujian, peserta ujian) punya bottom navbar di HP (`NavPortal`); tombol aksi portal satu gaya per jenis
    (§4.1 — `btn-gold` hanya situs publik); kepala tabel & `GroupedSection` terang; **freeze tabel otomatis** (`PembekuTabel`, §5.7 —
    tabel layar baru wajib dibungkus `overflow-x-auto`); kartu bottom sheet berwarna lembut.
    **Seragam detail (15 Sep 2026 malam, DESIGN_SYSTEM §4.1 & §5.3):** grid kartu angka = `.kisi-kartu(-N)`; cari/saringan/tab + tombol =
    `.baris-alat` (`.alat-cari/.alat-saring/.alat-tab/.alat-aksi`); satu pintu notifikasi (`KotakNotifikasiTombol tindakan`, tanpa
    `NotificationBell`/`AdminTopBar`); Kembali & `PrintButton` = `btn-modal-cancel`; halaman PortalShell pakai `PageHeader`.

43. **Rapor = verifikasi bertingkat (17 Sep 2026).** Guru mengisi nilai di Jurnal Mengajar (bisa impor Excel: `/api/teacher/journal/impor-nilai`)
    → wali kelas MENGUNCI (`RaporKunci`, halaman Nilai & Rapor Kelas) → Kepala Sekolah MENGESAHKAN (`RaporApproval`, bisa "Sahkan Semua";
    ditolak 409 bila belum dikunci) → rapor Siswa/Orang Tua tampil. Selama terkunci, simpan jurnal & impor ditolak (`pesanNilaiTerkunci`,
    src/lib/rapor-verifikasi.ts); buka kunci hanya bila belum disahkan. Isi rapor satu sumber: `susunRaporSiswa` (src/lib/rapor-data.ts) —
    KKM per mapel (`Subject.kkm`, kosong = SiteSetting `akademik.kkmDefault` lewat `petaKkm`), predikat interval dari KKM & deskripsi capaian
    (src/lib/deskripsi-capaian.ts, memakai materi jurnal bernilai tertinggi/terendah), kehadiran per rentang semester (`rentangSemester`).
    Semester rapor dari `semesterRapor()` (WIB) — jangan menulis generateSemesters baru di route.
44. **Izin/sakit online (17 Sep 2026).** Orang tua mengajukan (`IzinSiswa`, /dashboard/parent/izin) → wali kelas memutuskan
    (/dashboard/teacher/izin-siswa; Kesiswaan/BK memantau) → disetujui = `Attendance` hari sekolah dalam rentang diisi IZIN/SAKIT
    (`hariSekolah`, memakai daftar libur). **Lampiran rahasia** disimpan di `public/uploads/rahasia/` — proxy memblokir `/uploads/rahasia/*`
    dan `/api/uploads/rahasia/*`; dibuka hanya lewat rute berizin (`/api/izin-siswa/[id]/lampiran`, `bolehLihatIzin`). Berkas sensitif baru
    (kesehatan, dokumen pribadi) WAJIB memakai pola folder rahasia ini, bukan `/api/upload` biasa. Rekap harian kelas ke wali kelas =
    pengingat `notifikasi.jamRekapKelas`.
45. **Akses berbasis jabatan untuk halaman yang juga dipakai Admin:** guru tidak bisa membuka `/dashboard/admin/*` (layout Admin hanya
    menerima jabatan TU). Tautan dari halaman guru WAJIB menuju rute portal guru — pola: pindahkan isi halaman ke komponen bersama dengan
    `basePath`/`kembaliHref` (contoh `KalenderAbsensiCetak`, `BukuIndukGuruManager`, `DapodikManager`) lalu buat pembungkus di
    `/dashboard/teacher/*`. Periksa dengan penelusur jabatan (`rayap-jabatan.mjs`: masuk sebagai tiap pemegang jabatan, buka tiap grup menu,
    tandai tautan yang dialihkan). Sinkron Dapodik: `verifyDapodikAccess` (Admin & Operator Sekolah penuh, staf TU baca), kunci Web Service
    bisa diganti dari halaman (terenkripsi AES-GCM di SiteSetting `dapodik.kunci`), pasangan manual `DapodikPasangan` dipakai paling dulu.
46. **Sasaran pengumuman/survei/kegiatan = satu aturan (`src/lib/pengumuman.ts`, 17 Sep 2026).** Kolom `targetRole`
    (ALL/STUDENT/PARENT/STUDENT_PARENT/TEACHER/ADMIN) + `targetKelasIds`/`targetJurusanIds` (hanya menyaring siswa & orang tua —
    orang tua lewat kelas anaknya) + `targetJabatan` (hanya guru/staf). Pakai `konteksPenerima` + `syaratSasaran` untuk "apa yang
    ditujukan ke saya", `penerimaPengumuman` untuk daftar penerima (notifikasi, statistik pembaca, daftar belum hadir), dan
    `rapikanSasaran` untuk validasi isian (wali kelas hanya kelas walinya). Model baru yang punya sasaran WAJIB memakai kolom yang
    sama. Konfirmasi baca (`PengumumanDibaca`) & survei belum diisi masuk antrean "Perlu tindakan" (guru, siswa, orang tua).
    Pintu tautan notifikasi lintas peran: `/pengumuman`, `/survei`, `/layanan-sarpras` (mengalihkan ke portal pengguna).
    **`/dashboard` polos TIDAK ADA** — cadangan pengalihan memakai `/login` (proxy meneruskan yang sudah masuk ke dashboard-nya).
47. **Sarpras & Lab (17 Sep 2026) — `src/lib/sarpras-akses.ts`.** Semua guru & staf: Layanan Sarpras (lapor kerusakan berfoto ke
    folder `/uploads/sarpras`, pinjam barang/pesan ruang). Pengelola penuh = Admin, staf TU, Wakil Kepala Sarana Prasarana;
    Kepala Laboratorium = lingkup LAB (aset/ruang/lokasi berisi kata "lab" — `lingkupDari`). Pemesanan ruang ditolak bila bentrok
    dengan pemesanan lain ATAU Jadwal Pelajaran di ruang itu (`cekBentrokRuang`); daftar ruang = ruang di jadwal + Ruang Ujian +
    `sarpras.ruangTambahan`. Barang kembali rusak / temuan perawatan otomatis menjadi laporan kerusakan. Perubahan lokasi aset
    dicatat `MutasiAset`. Label QR aset → `/aset/<id>`; QR presensi kegiatan → `/hadir/<id>?t=` (token HMAC 30 dtk, berlaku 5 menit,
    `src/lib/kegiatan-qr.ts`). Keduanya route handler: bila belum masuk, tujuan dititipkan di cookie `lanjut_masuk` dan dipakai
    `ambilLanjut` di actions/auth.ts — HANYA pola `/aset/…` & `/hadir/…?t=…` (jangan dilonggarkan jadi pengalihan bebas).
48. **Survei & angket (17 Sep 2026) — `src/lib/survei.ts`.** Jawaban unik per akun lewat `penanda` (hash akun+survei) — survei anonim
    tidak menyimpan userId/kelas sama sekali. Jenis AKPD (20 butir Ya/Tidak per bidang pribadi/sosial/belajar/karier) & SOSIOMETRI
    (pilih teman sekelas) selalu bernama dan hasilnya rahasia (pembuat, Guru BK/Wakasek Kesiswaan, Admin). Pertanyaan terkunci
    setelah ada jawaban. Hasil & unduhan .xlsx di `/api/survei/kelola/[id]/hasil`.
49. **QR keaslian dokumen (17–18 Sep 2026).** Pola sama untuk semua: kolom token acak (`randomBytes(18).toString("base64url")`)
    di baris data, dibuat SEKALI saat dokumen pertama dicetak, QR berisi `${ALAMAT_APLIKASI}/verify/<jenis>/<token>`, dan halaman
    verifikasi publik hanya menampilkan identitas dokumen (bukan isinya). Sudah dipakai: sertifikat PKL (`Internship.sertifikatToken`),
    piagam prestasi (`StudentPointRecord.sertifikatToken`), sertifikat ekstrakurikuler (`ExtracurricularMember.sertifikatToken`),
    surat keluar (`Surat.verifikasiToken`), rapor format sekolah (`RaporVerifikasi` per siswa × semester × jenis, `qrRapor` di
    src/lib/rapor-qr.ts — HANYA rapor yang sudah disahkan, /verify/rapor/<token>). Dokumen cetak baru yang perlu dijamin keasliannya mengikuti pola ini.
50. **Berkas pribadi baru WAJIB folder rahasia.** Arsip SK & dokumen kepegawaian disimpan di `public/uploads/rahasia/kepegawaian`
    (diblokir proxy) dan dibuka lewat `/api/kepegawaian/sk/[id]/berkas` — pengelola kepegawaian atau guru pemiliknya saja
    (`src/lib/arsip-sk.ts`). Foto kerusakan Sarpras, liputan, dan poster BKK bukan data pribadi sehingga tetap di `/uploads`.
51. **Pengingat terjadwal baru** ditambahkan di `src/lib/pengingat-terjadwal.ts` + kunci jam di `PENGATURAN_NOTIFIKASI`,
    DEFAULTS `site-settings.ts`, API `/api/admin/notifikasi`, dan daftar jam di `NotifikasiPushManager` — empat tempat itu harus
    diubah bersamaan, jika tidak jamnya tidak bisa diatur admin. Ringkasan mingguan orang tua berjalan tiap SABTU
    (`notifikasi.jamRingkasanOrtu`); pengingat apa pun otomatis diam pada hari libur (`cekLibur`).

52. **Presensi pegawai punya TIGA jalur (18 Sep 2026)** — semuanya menulis ke `StaffAttendance` (unik per userId+tanggal):
    Tata Usaha mengisi manual (/dashboard/admin/presensi-pegawai), pegawai memindai QR absensi gerbang lewat HP
    (/dashboard/{teacher,admin}/absen-mandiri → `/api/pegawai/absen-mandiri`), atau kartu pegawainya dipindai di stasiun
    (`/api/admin/absensi-scan`, kode bukan NIS → dicoba sebagai NIP/awalan email lewat `pegawaiDariKartu`). Logika satu pintu:
    `catatPresensiPegawai` (src/lib/presensi-pegawai.ts) — pindaian pertama mengisi jam masuk, pindaian ≥60 menit berikutnya
    mengisi jam pulang, dan status yang sudah ditetapkan TU (IZIN/SAKIT/DINAS_LUAR/CUTI) TIDAK PERNAH ditimpa (aturan sama
    dengan absensi siswa, #33). Hari libur ditolak lewat `cekLibur`.

53. **Kartu identitas digital ada untuk SEMUA akun** — `/kartu-identitas` (semua peran) menampilkan `KartuAnggotaDigital`
    dengan `mode="identitas"`: QR-nya sama persis dengan kartu tanda cetak (NIS/NIP/awalan email), jadi bisa dipindai untuk
    presensi gerbang, perpustakaan, dan layanan lain tanpa kartu fisik. Tautannya ada di grup "Akun" tiap sidebar dan di
    `MenuAkunMobile`. Jangan membuat halaman kartu kedua — tambahkan mode baru ke komponen yang sama.

54. **Navigasi HP = bottom navbar 5 slot + kisi menu di dashboard (18 Sep 2026)** — lihat DESIGN_SYSTEM §3.6 & §5.8.
    Bottom sheet berisi daftar menu DIHAPUS: `MobileBottomNav` sekarang menerima `items` (4 tautan) + `beranda`
    (tombol bulat tengah ke dashboard). Seluruh menu ada di dashboard lewat `MenuLengkap` (kisi ikon bergradasi ala
    BRImo/Livin) dan halaman `/dashboard/<portal>/menu` yang punya kotak "Cari menu". **Satu sumber menu**: tiap
    Sidebar mengekspor pembangun grupnya (`grupMenuSiswa`, `grupMenuGuru`, `grupMenuOrtu`, `menuGroups`,
    `menuGroupsTas`) dan `src/lib/menu-konteks.ts` menyediakan keadaan akun (jabatan/wali kelas/buku terlambat)
    untuk layout MAUPUN halaman menu — menambah menu cukup di satu tempat. Portal di luar /dashboard memakai
    `src/lib/menu-portal.ts` + `KisiMenuPortal` di berandanya. `MenuAkunMobile` tetap memakai `BottomSheet`
    (Profil, Kartu Identitas, Pencarian Cepat, Keluar) — itu bukan laci menu.

55. **Superadmin berakses PENUH lewat portalnya sendiri (19–20 September 2026).** Superadmin bukan guru/pegawai,
    jadi ia TIDAK boleh dilempar ke shell portal guru untuk melihat dashboard/halaman jabatan. Pola: isi halaman
    diekstrak ke `src/components/jabatan/<Nama>.tsx`, lalu DUA pembungkus tipis — portal guru (pemegang jabatan) &
    portal admin. Sudah dipasang: 12 dashboard jabatan di grup **"Dashboard Jabatan"** (`/dashboard/admin/dashboard-jabatan/*`)
    dan 11 halaman pengawasan yang dimasukkan ke grup FUNGSINYA masing-masing (Buku Piket & Kinerja Pimpinan →
    Kepegawaian; Izin/Sakit & Piket Kelas → Kehadiran Siswa; Kunjungan Rumah, Kesehatan Siswa, Kontak Ortu →
    Kesiswaan & BK; Pengesahan Rapor & Rekap UKK → Kurikulum; Status MoU Mitra → PKL; Branding → Website).
    JANGAN menautkan halaman admin ke rute `/dashboard/teacher/*` — layout guru memang menerima ADMIN, tetapi
    sidebarnya jadi nyaris kosong. Halaman yang MELEKAT pada orangnya (Jurnal/Jadwal/Materi/Rapor Kelas/Absen
    Mandiri) tidak disalin: versi pengawasannya sudah ada di admin.

56. **Tombol ikon-saja HANYA untuk kata kerja umum (20 September 2026).** `.alat-aksi` menyembunyikan teks tombol
    (`font-size: 0`) demi hemat ruang. Itu jelas untuk Tambah/Cetak/Kembali/Simpan/Unduh/Ekspor, tetapi tombol yang
    NAMANYA membawa arti sendiri ("Kalender Bulanan", "Lapor Kerusakan", "Denah Ruang Ujian", "Tampilkan QR") jadi
    tidak bisa ditemukan — ikonnya terbaca sebagai aksi umum (laporan user: "rekap absensi perkalender kok hilang?").
    Beri `.btn-teks` pada tombol semacam itu (60 tanda di 43 berkas). `.alat-teks` pada WADAH bila semua tombolnya
    wajib berteks.

57. **Gambar menu: satu fitur satu gambar (`src/components/shared/IlustrasiMenu.tsx`).** Dua FITUR BERBEDA tidak
    boleh berbagi gambar; fitur SAMA di beberapa portal justru WAJIB sama. Aturan kata kunci terlalu longgar untuk
    membedakan menu serumpun, jadi setiap fitur didaftarkan tegas di `PETA_ILUSTRASI`. Jebakan halus: pemetaan
    memakai LABEL ASLI menu, bukan yang tampil di layar — "Poin Siswa (Tata Tertib)" tertangkap aturan "tata tertib"
    lebih dulu. Memeriksa: bandingkan innerHTML SVG tiap ubin di kelima halaman `/menu`, bukan nama gambarnya.

58. **Halaman notifikasi ada DI DALAM portal, bukan rute akar.** `/notifikasi` hanyalah PINTU yang mengalihkan ke
    `/dashboard/{teacher,student,parent}/notifikasi` dan `/dashboard/admin/kotak-notifikasi` (nama beda karena
    `/dashboard/admin/notifikasi` sudah dipakai PENGATURAN push). Sebagai halaman akar ia kehilangan sidebar,
    bottom navbar, dan latar dashboard. Tombol lonceng menuju rute portal LANGSUNG (ditentukan dari `usePathname`),
    bukan lewat pintu — lewat pintu, layar krem kosong di luar portal tampil beberapa detik dulu. Tiap rute punya
    `loading.tsx` supaya tidak pernah layar kosong.

59. **Dapodik: alamat bebas IP/domain, kolom host & port terpisah (20 September 2026).** `periksaAlamatDapodik`
    menerima IP privat, IP publik, dan nama domain termasuk `localhost`; yang ditolak hanya yang membuatnya bukan
    alamat (skema selain http/https, nama pengguna/sandi, jalur, query). Aturan lama "hanya IPv4 jaringan lokal"
    menolak alamat yang BENAR: `<BLOK-IP-SERVER>` bukan rentang privat RFC1918 (privat mulai 172.**16**), ia dulu lolos
    hanya lewat jalur "sama /16 dengan bawaan .env". `hostLokal()` kini menghitung host yang SATU BLOK /16 DENGAN
    SERVER SITUS sebagai lokal — dipakai HANYA untuk memutuskan perlu-tidaknya peringatan "kunci Web Service ikut
    terkirim ke alamat ini", bukan untuk menolak. Pembantu yang dipakai halaman ada di `src/lib/dapodik-alamat.ts`
    (netral) karena `dapodik.ts` bertanda `server-only`.

60. **Pratinjau Sinkron Dapodik diambil PER LANGKAH + disinggahkan (20 September 2026).** Tiga daftar wajib
    berurutan dan lamanya berubah-ubah (terukur 20–47 detik), sehingga satu permintaan panjang sesekali dibalas
    **502** oleh proxy di depan aplikasi. Halaman memanggil `?langkah=pd|gtk|rombel` satu per satu (±15 detik tiap
    permintaan) — hasilnya disinggahkan 10 menit di `dapodik-sinkron.ts`, lalu permintaan tanpa `langkah`
    membandingkan dari singgahan (0,5 detik). Buka ulang halaman jadi 0,4 detik. JANGAN memparalelkan ketiganya:
    Dapodik membalas halaman galat HTML.

61. **CBT: token bersama per KEGIATAN + kunci otomatis saat keluar layar (20 September 2026).**
    - `KegiatanUjian.token` = satu token untuk SEMUA mapel dalam kegiatan itu; server memilihkan ujian yang sedang
      dibuka untuk kelas siswa (`/api/student/exams/join`). Opt-in per kegiatan lewat Pengaturan Ujian → Kegiatan
      Ujian; token per-ujian TIDAK dihapus dan tetap berlaku sebagai cadangan. Berganti berkala lewat
      `tokenOtomatisMenit` (`putarTokenKegiatanBilaPerlu`, hanya dipanggil dari layar petugas). Token kegiatan &
      token ujian berbagi SATU ruang — `buatTokenUnik` memeriksa keduanya. Ruang Kendali menampilkan token kegiatan
      lebih menonjol (emas) dan token ujian mengecil sebagai cadangan.
    - `batasPindahTab` terlampaui = pengerjaan LANGSUNG dikunci server (`terkunci` + `alasanKunci`), bukan sekadar
      dicatat. Siswa pulih otomatis begitu pengawas menekan Reset Login / Buka Kunci: layar terkunci mengetuk
      `denyut` tiap 8 detik. Tanpa itu `aktif = … && !blokir` membongkar interval denyut, sehingga tindakan pengawas
      baru terasa setelah siswa hard-refresh.
    - Layar penuh diminta DI DALAM klik "Mulai" (di luar gestur pasti ditolak browser); kalau keluar, layar ujian
      tertutup tirai satu tombol. Wake lock menahan layar. **Batas yang harus diterima: Alt-Tab, tombol Home, dan
      menutup aplikasi TIDAK bisa dicegah dari halaman web** — kunci sungguhan butuh Safe Exam Browser / kiosk
      Android. Tirai layar penuh dilewati bila `requestFullscreen` tidak ada (iOS Safari), supaya peserta iPhone
      tidak terkunci di luar ujian.
    - Daftar Ujian & Bank Soal TIDAK LAGI mensyaratkan pilih kelas+mapel — dropdown itu murni saringan (hak akses
      dijaga server: `filterDaftarUjian` & cakupan bank soal per penugasan). Mapel butir ditanyakan DI DALAM
      formulir Tambah Soal. Judul ujian baru terisi otomatis dari nama kegiatan aktif.
    - Impor Word: tabel di naskah paragraf kini IKUT jadi isi pertanyaan (dulu menutup soal lalu dibuang, sehingga
      soal bertabel hilang). Gaya tabelnya di `.soal-html table`.
    - Edit soal saat ujian berjalan HANYA lewat tombol pensil oranye (`/api/teacher/exams/[id]/soal-live`). Editor
      biasa mengunci susunan soal begitu ada yang mengerjakan dan Simpan SENGAJA tidak mengirim `questions`.
      **MENAMBAH soal saat berjalan boleh, tetapi HANYA di ujung** (`POST /api/teacher/exams/[id]/tambah-soal`, tombol
      "Tambah soal di ujung" yang muncul justru saat susunan terkunci — 23 Sep 2026). Aman karena `nilaiAttempt` menilai
      dari `ExamAttempt.urutan.urutanSoal` masing-masing: soal baru DISAMBUNGKAN ke urutan pengerjaan yang belum
      dikumpulkan (opsi diacak dengan benih yang sama — paket denah bila ada), sedangkan yang sudah mengumpulkan tidak
      disentuh sehingga nilainya tetap dari soal yang benar-benar dikerjakan. `diperbaruiLiveAt` diisi supaya `versiSoal`
      berubah (layar peserta memuat ulang naskah) dan `kirimSinyal` mempercepatnya. JANGAN menyisipkan di tengah atau
      menghapus soal — jawaban terikat id soal dan urutan acak sudah beku.

62. **CBT — satu sumber token, alat periksa, dan jalur tahan putus (20–21 September 2026).**
    - **Token yang ditampilkan SATU SUMBER di SEMUA layar**: token bersama kegiatan bila ada, selain itu token
      ujian. Dipakai Ruang Kendali, Daftar Ujian, kepala halaman detail, dan Papan Pantau (`susunPapanPantau`
      mengembalikan `token` = yang dibacakan, `tokenUjian` = cadangan teknis). Token per-ujian tetap DITERIMA di
      server tetapi TIDAK ditampilkan bila ada token bersama. Temuan nyata: memperbaiki dua layar tapi lupa satu
      membuat ujian yang sama tampil dengan dua token berbeda — lebih buruk daripada masalah awalnya.
    - Token bersama **dibuat otomatis** untuk kegiatan aktif (`pastikanTokenKegiatan`, dipanggil dari layar petugas)
      dan mewarisi `ujian.tokenOtomatisMenit` sekolah. Opt-in manual sebelumnya membuat token tidak pernah terbuat.
      **Tiga tingkat setelan token, jangan tertukar (temuan user 23 Sep 2026: mengisi 240 di ujian mapel, token tetap
      berganti tiap 5 menit):** (1) Pengaturan Ujian = nilai BAWAAN untuk ujian BARU dan untuk token bersama yang baru
      dibuat — mengubahnya TIDAK menyentuh ujian/kegiatan yang sudah ada; (2) `Exam.tokenOtomatisMenit` = hanya berlaku
      bila kegiatannya TIDAK memakai token bersama; (3) `KegiatanUjian.tokenOtomatisMenit` = yang sebenarnya berlaku
      untuk token yang dibacakan peserta. Sejak 23 Sep 2026 nilai (3) bisa diisi di formulir Kegiatan Ujian
      (PUT /api/teacher/kegiatan-ujian/[id] memang sudah menerimanya sejak awal, isiannya saja yang belum ada), tabel
      kegiatan menampilkan "tiap N mnt", dan penyunting ujian menandai isian tokennya "tidak dipakai" bila kegiatan
      memakai token bersama.
    - **Kemiripan jawaban** (`src/lib/kemiripan-ujian.ts`): sinyalnya SAMA-SAMA SALAH DENGAN PILIHAN SAMA, bukan
      sama-sama benar. Dijalankan saat diminta, keluarannya daftar untuk DIPERIKSA — bukan tuduhan. Uraian/unggah
      tidak dibandingkan.
    - **Naskah tahan putus**: soal yang sudah dilihat disinggahkan di perangkat + satu soal berikutnya diambil
      lebih awal. JANGAN menyinggahkan seluruh naskah — `satuSoalPerHalaman` ada supaya naskah utuh tidak pernah
      berada dalam satu muatan yang bisa disalin lewat alat pengembang.
    - **Safe Exam Browser** (`src/lib/seb.ts`, `Exam.wajibSeb`): verifikasi `X-SafeExamBrowser-RequestHash` =
      SHA256(URL + Browser Exam Key). Kunci keluar dari SEB Configuration Tool di komputer sekolah — BUKAN dibangkitkan
      server — lalu ditempel ke `ujian.sebKunci`. Selama kunci kosong, ujian ber-`wajibSeb` TIDAK dikunci mati.
    - **Batalkan soal** saat ujian berjalan = `skor` jadi 0 + `skorButir` semua peserta 0 untuk butir itu, lalu
      nilai dihitung ulang. JANGAN menghapus baris soal yang sudah dikerjakan: urutan acak & jawaban terikat ID soal.
      Ganti isi soal lewat "Perbaiki Live" atau "Ambil isi dari Bank Soal" — hanya butir berjenis sama dan
      berjumlah pilihan sama (kode pilihan A, B, C… harus tetap).
    - Bank Soal dan soal ujian adalah **SALINAN**, bukan tautan — mengedit bank tidak mengubah ujian yang sudah dibuat.
    - Koreksi uraian: mode **Per Soal** (bawaan, standar penilaian konsisten) & Per Siswa; **Simpan Semua Skor**
      mengirim hanya yang berubah, dan nilai tiap peserta dihitung ulang SEKALI di akhir.
    - "Jadikan Ujian" dari impor Word/Excel: soal dititipkan lewat `sessionStorage` (`impor-ujian`), bukan URL —
      naskah bisa ratusan KB. Mapel & judul terisi dari kepala naskah; kelas & jadwal tetap di penyusun ujian.
    - **Template unduhan pakai `exceljs`**, bukan `xlsx`: SheetJS edisi komunitas TIDAK bisa menulis gaya sel
      (font, garis, warna hilang). Tata letak mengikuti berkas contoh user: Pengaturan A–B, Kunci F–K (termasuk kolom
      "Pedoman Penskoran"), "Kisi - Kisi Soal" L–O. Arial Narrow di Excel & Word. Pembaca Excel berbasis LABEL kolom,
      jadi berkas lama (Kunci F–J) tetap terbaca.
    - **Uraian/unggah punya DUA pegangan (21 Sep 2026): `kunci.acuan` = JAWABAN ACUAN (kolom Kunci Jawaban Excel) dan
      `kunci.rubrik` = PEDOMAN PENSKORAN (kolom "Pedoman Penskoran").** Berkas tanpa kolom Pedoman → isi kolom Kunci
      disimpan sebagai rubrik seperti dulu (`terapkanKunci(b, kunci, pedoman)`, pedoman null = kolom tidak ada).
      Keduanya tampil di penyunting soal, Kartu Soal, layar Koreksi (`PeganganKoreksi`), dan LAMPIRAN kunci cetak
      kisi-kisi (`?kunci=1` — sengaja bukan bawaan karena kisi-kisi lazim dibagikan ke siswa). Tidak pernah dikirim
      ke siswa selama ujian (`soalUntukSiswa` hanya menyertakan kunci setelah dikumpulkan).
    - **Kartu Soal** (`/pusat-ujian/[id]/kartu-soal`): satu butir satu halaman, seluruh isi dari data yang sudah
      ada. Belum ada contoh format sekolah di data TU (diperiksa 21 Sep 2026: tabel `Arsip` kosong) — bila sekolah
      mengirim formatnya, sesuaikan.

63. **Ujian per KELAS vs per RUANG (21 September 2026) — `KegiatanUjian.mekanisme`.** RUANG = peserta dibagi lewat Denah
    Ruang, pengawas per ruang × sesi (`PengawasUjian`). KELAS (lazimnya STS) = siswa ujian di kelasnya sendiri; satu ujian
    boleh punya **jam berbeda per kelas** (`Exam.jadwalKelas`, startTime/endTime = amplopnya) dan pengawasnya OTOMATIS guru
    pengampu mapel itu di kelas itu (Penugasan Mengajar, cadangan pembuat ujian) — tidak disimpan, hanya PENGGANTI yang
    disimpan (`PengawasKelasUjian`). Satu sumber: `susunPengawasKelas` (src/lib/pengawas-kelas.ts), dipakai halaman Pengawas
    (`PengawasKelasPanel`, jam per kelas bisa diubah di sana) & Jadwal Pengawas guru.
    **Setiap jalur yang membuka/menutup ujian untuk siswa atau menghitung batas waktunya WAJIB `jendelaKelas(exam, classIdSiswa)`**
    (src/lib/jadwal-ujian-kelas.ts) — bukan `exam.startTime/endTime` langsung: daftar & join siswa, detail/jawab/denyut/submit/info,
    papan pantau, massal, lanjutkan, jejak, ruang kendali. Mengubah jam satu kelas dari halaman Pengawas melengkapi jadwal
    SEMUA kelas ujian itu dulu — kelas tanpa jam khusus memakai amplop, yang ikut bergeser bila tidak dilengkapi.
    Denah Ruang: ruang bisa diberi peruntukan jurusan/kelas (`KegiatanUjian.aturRuang`, `bagiPeserta(…, peruntukan)`).

64. **Pesan pengawas ke layar peserta (21 September 2026) — `PesanUjian`, src/lib/pesan-ujian.ts.** Dikirim dari Papan Pantau &
    Ruang Kendali (`PesanPesertaPanel`; "Pesan ke Semua Ujian Berlangsung" = `/api/teacher/exams/pesan-massal`). Sampai ke siswa
    LEWAT DENYUT yang sudah ada (±20 detik) + muatan awal halaman ujian — jangan membuat saluran/polling baru per siswa. Sasaran
    SEMUA/KELAS/JURUSAN/SISWA/RUANG; jurusan & ruang DIURAI saat dikirim jadi `kelasIds`/`siswaIds` supaya penyaring di denyut
    tetap satu kueri murah. `questionId` = soal urutan asli; layar siswa menerjemahkannya lewat `peta` ke nomor di urutan
    acaknya sendiri (tombol "Buka soal"). "Mengerti" diingat di localStorage (`pesan-dibaca:<examId>`), pesan ditarik = `ditarikAt`.
65. **Rekap Nilai Ujian (21 September 2026) — /pusat-ujian/rekap-nilai.** Keputusan user: rekap & unduh Excel saja, **TIDAK
    dikirim ke Jurnal/nilai rapor** (sekolah akan memakai e-Rapor pemerintah) — jangan membuat tombol "kirim ke jurnal/rapor".
    Data mentah `muatRekapNilai` (src/lib/rekap-nilai-ujian.ts: reguler = nilai utama, susulan mengisi bila reguler kosong,
    remedial terpisah, `s` = sementara), hitungan MURNI di src/lib/rekap-nilai-hitung.ts dipakai layar & Excel
    (src/lib/rekap-nilai-excel.ts, exceljs bergaya) supaya angkanya selalu sama. Cakupan: guru = ujian yang diampu + semua mapel
    kelas walinya; Admin/TAS/Wakakur = semua. KKM lewat `petaKkm` per tingkat+jurusan kelas.
66. **Alat bantu ujian gelombang 1 (21 September 2026).**
    - **Saran skor uraian** (`src/lib/saran-skor.ts`, murni, jalan di browser guru): jawaban acuan dipecah jadi poin, dicocokkan
      per kata dasar (imbuhan sederhana & salah ketik 1 huruf ditoleransi), kata yang sudah ada di SOAL tidak dihitung (menyalin
      soal ≠ skor), bobot dari angka "(n)" di pedoman bila jumlahnya sama dengan jumlah poin. HANYA SARAN — "Pakai saran" /
      "Isi dengan Saran" mengisi kotak skor, guru tetap menekan Simpan. Jangan pernah menyimpan skor saran otomatis.
      Hindari regex lookbehind di kode klien: Safari iPhone lama gagal mengurainya dan seluruh halaman rusak.
    - **Kemiripan + denah + waktu** (`cariKemiripan`): skor risiko = kemiripan salah-sama + posisi kursi (bersebelahan/depan-
      belakang/diagonal dari `RuangUjian.kolom`) + korelasi pola waktu per soal (`waktuSoal`, log). Ambang dilonggarkan untuk
      yang duduk berdekatan. Ditambah daftar siswa yang selesai jauh lebih cepat dari median. Tetap daftar untuk DIPERIKSA.
    - **Paket soal menurut denah** (`Exam.paketDenah` 0/2/3/4, `paketDariKursi` di src/lib/ujian-acak.ts): benih pengacakan =
      paket (bukan attempt) → siswa berpaket sama melihat urutan sama, yang duduk berdekatan berbeda. Paket disimpan di
      `ExamAttempt.urutan.paket` dan tampil di papan pantau. Siswa tanpa kursi di denah tetap diacak per siswa. Urutan hanya
      dibuat SEKALI (saat attempt pertama dimuat) — mengubah denah setelahnya tidak memindahkan paket siswa yang sudah mulai.
67. **MAPEL DINIYAH = MAPEL TAMBAHAN (keputusan user 21 September 2026, "paling penting").** Dikenali dari `Subject.category`
    (data: "Kelompok Mata Pelajaran Diniyyah" — cocokkan dengan `/diniy/i`, JANGAN string persis) lewat `src/lib/mapel-diniyah.ts`
    (`adalahKategoriDiniyah`, `namaMapelDiniyah()` untuk nilai/ujian yang mencatat mapel dengan NAMA). Aturannya:
    **DKN: TIDAK tampil sama sekali** (disaring di `/api/teacher/dkn/[classId]`). **Ujian: tetap boleh dibuat & dikerjakan**, tetapi di
    Rekap Nilai Ujian menjadi kelompok TERPISAH (kolom berkepala emas setelah Peringkat) dan TIDAK ikut jumlah, rata-rata, maupun
    peringkat (`DataRekap.diniyah`, `legerKelas`→`mapelDiniyah`). Rekap/peringkat/rata-rata lintas mapel baru WAJIB memakai aturan ini.
68. **Soal berparameter & soal interaktif (gelombang 2, 21 September 2026).**
    - **Parameter** (`src/lib/soal-parameter.ts`): `{ABSEN}` (nomor absen, urut nama siswa AKTIF di kelasnya), `{NIS2}`, `{NIS3}`,
      `{ACAK}` (1–99, tetap per siswa+ujian). Boleh berhitung `{ABSEN*4+1}` — diurai sendiri (bukan eval); kurung kurawal yang
      tidak memuat variabel (himpunan `{1, 2, 3}`, LaTeX) dibiarkan. Diisi di SERVER di tiga tempat, satu sumber
      (`isiButirParameter` + `variabelSiswaUjian`): layar siswa (`/api/student/exams/[id]`), penilaian (`simpanNilaiAttempt` —
      kunci Isian Singkat per siswa), dan layar koreksi (jawaban acuan & pedoman per siswa + `templat` aslinya). Pratinjau guru
      memakai `CONTOH_VARIABEL`. Jalur baru yang menampilkan/menilai soal ke siswa WAJIB lewat fungsi yang sama.
    - **Jenis interaktif** `TITIK_GAMBAR` (ketuk N titik = jumlah area), `SERET_LEPAS` (label → tempatnya; `kode` label = kode area),
      `URUTKAN` (opsi disimpan dalam urutan BENAR). Koordinat selalu PERSEN gambar. Nilai proporsional (`nilaiButir`).
      `kunci.area` TIDAK PERNAH dikirim ke siswa (`soalUntukSiswa` hanya `gambar` + `jumlahTitik`); URUTKAN SELALU diacak dan
      tidak pernah tampil dalam urutan benar (`ujian-acak.ts`). Perbaikan live: jumlah area/label/langkah dikunci (`soal-live`),
      letak area boleh digambar ulang. Kemiripan jawaban tidak membandingkan jenis berkoordinat. Belum bisa diimpor dari
      Word/Excel — dibuat lewat penyunting soal (Bank Soal / penyusun ujian).
69. **Tindakan pengawas sampai ke layar peserta ±1 detik lewat SINYAL long-poll (21 September 2026) — `src/lib/sinyal-ujian.ts`.**
    Denyut peserta hanya tiap 20 detik, jadi Reset Login/Waktu dulu terasa "harus hard refresh". Layar ujian membuka
    `GET /api/student/exams/[id]/sinyal` yang DITAHAN server (≤25 dtk, tanpa kueri selama menunggu); `kirimSinyal(examId, [studentId])`
    melepasnya dan layar langsung menjalankan denyut (atau pemulihan kunci). Peta penunggu di `globalThis` (satu proses Node).
    **Route baru yang mengubah keadaan pengerjaan/ujian WAJIB memanggil `kirimSinyal`** setelah tersimpan — sudah di lanjutkan
    (per siswa), massal, pesan, pesan-massal, soal-live, PUT ujian, jam per kelas (Pengawas). Sinyal umum (tanpa studentIds)
    disebar acak 0–3 dtk di klien. Denyut 404 (pengerjaan dihapus "Ulang") → layar peserta kembali ke halaman token.
    **Token yang tampil = `tokenTampilUjian`** (ujian-server.ts) di papan pantau & `GET /api/teacher/exams/token?ids=` yang
    dipakai `useTokenLangsung` (detail ujian, Daftar Ujian; Pengaturan Kegiatan memuat ulang tiap 15 dtk). Perputaran token
    ATOMIK (`updateMany where token = yang dibaca`) — dua layar petugas tidak lagi menghasilkan dua token berbeda.
70. **Jam = `<TimePicker>` 24 jam (src/components/shared/TimePicker.tsx), JANGAN `<input type="time">`** (21 Sep 2026, permintaan
    user: "jangan AM PM"). Isian jam bawaan ikut bahasa perangkat → AM/PM di HP berbahasa Inggris. Nilai tetap "HH:MM" (sama dengan
    input bawaan), bisa diketik (0715, 7.15) atau dipilih; `ringkas` untuk sel tabel. 23 isian sudah diganti. Menampilkan jam juga
    selalu `toLocaleTimeString("id-ID", …)`, jangan tanpa lokal.
71. **Build Docker: `npm ci` tahan gangguan jaringan (21 Sep 2026).** Cache build dipangkas otomatis (rantai build: sisakan 3 rollback,
    cache ≤25 GB — cache & image lama sempat memenuhi thin pool Proxmox 95%), sehingga lapisan `npm ci` kadang dibangun ulang dan
    jaringan sekolah memutus koneksi serentak (`ECONNRESET`). Dockerfile memakai cache mount `/root/.npm` + `--maxsockets=6` +
    percobaan ulang. Jangan tambahkan `# syntax=docker/dockerfile:1` — itu menarik image dari Docker Hub tiap build.
72b. **Pengerasan hasil audit CBT (24 September 2026).** (a) `POST /api/ujian/aplikasi/keluar` (PIN keluar mode ujian)
    kini WAJIB sesi login dan dibatasi per **akun + IP** — sebelumnya terbuka untuk siapa pun di internet dan satu sekolah
    berbagi satu IP, jadi PIN pendek bisa ditembaki. (b) `POST /api/student/exams/join` membatasi **15 tebakan token salah
    per siswa / 5 menit** (hitungan di memori, direset begitu token benar). (c) Token ujian & kegiatan dibuat dengan
    `randomInt` (node:crypto), bukan `Math.random`. (d) `lemparBilaPengalihan(galat)` (src/lib/galat-rute.ts) dipanggil di
    baris pertama SETIAP `catch` route CBT (35 berkas): penolakan `verifyRole` berupa redirect diteruskan apa adanya, tidak
    lagi tertelan jadi 500 palsu — pola ini dipakai juga untuk route baru.
    Yang DIPERIKSA dan sudah benar (jangan "diperbaiki" tanpa alasan): kunci jawaban hanya dikirim setelah dikumpulkan
    (`soalUntukSiswa(..., setelahSubmit)`, syarat `submitted && tampilkanNilai`), join tetap menyaring kelas peserta
    (`pesertaBoleh`), simpan jawaban memeriksa kepemilikan + tenggat + soal harus ada di `urutan` siswa itu + batas ukuran,
    rekaman lisan hanya bisa diputar pemilik/guru berwenang, dan semua rute guru berlingkup `ujianDalamCakupan`/`cakupanUjian`.

72. **Peserta Ditahan per kegiatan ujian (21 September 2026) — `PesertaDitahanUjian`, src/lib/peserta-ditahan.ts.** Jawaban atas
    "siswa belum menyelesaikan administrasi ujian, bagaimana pengecualiannya": panitia (`bolehAturUjian`) menahan siswa di
    /pusat-ujian/administrasi/ditahan → join token ditolak 403 untuk SEMUA ujian kegiatan itu (pesan + alasan), halaman mulai &
    daftar ujian siswa menampilkan alasannya, papan pantau/Ruang Kendali menandai "Ditahan". Pengerjaan yang sudah dimulai
    sebelum ditahan TIDAK diganggu (penahanan hanya mencegah MASUK). Lepas = hapus baris. Diisi manual — JANGAN dihubungkan ke
    modul Bendahara (keputusan user: modul itu tidak disentuh lagi). Jalur masuk ujian baru WAJIB memanggil `alasanDitahan`.
73. **Rumus matematika & kimia (22 September 2026).** Satu format: LaTeX di teks (`$…$` sebaris, `$$…$$` baris sendiri), kimia
    `\ce{…}`/`\pu{…}` (mhchem). Render SATU pintu `HtmlSoal`/`renderRumus` (src/components/ujian/HtmlSoal.tsx, KaTeX + mhchem, dimuat
    hanya bila ada penanda rumus). **Jawaban siswa WAJIB lewat `TeksRumus`** (di-escape dulu) — jangan pernah `HtmlSoal` untuk teks
    ketikan siswa (XSS). Input: `PaletRumus` + `TombolRumus` (src/components/ujian/PaletRumus.tsx) dipakai penyunting soal (pertanyaan,
    tiap pilihan, kunci isian, acuan, pedoman) DAN kotak jawaban isian/uraian siswa; menyisipkan di posisi kursor. Jangan menulis
    LaTeX di string JS biasa (`"\frac"` = form feed) — pakai `String.raw`. Impor Word: rumus Equation Editor (OMML) diubah ke LaTeX
    sebelum mammoth oleh `gantiRumusWord` (src/lib/omml-latex.ts); "Equation 3.0" lama tetap gambar. Isian Singkat: pembanding
    `rapikan` (src/lib/soal.ts) menyamakan `$…$`, `\ce{}`, indeks Unicode (H₂O), dan koma desimal.
74. **Jawaban Lisan = jenis soal `LISAN` (22 September 2026).** Rekaman (MediaRecorder, `PerekamLisan`) diunggah ke
    `POST /api/student/exams/[id]/lisan` → folder RAHASIA `public/uploads/rahasia/ujian-lisan/<examId>/` → jawaban = alamat
    `/api/ujian/lisan/<examId>/<attemptId>-<questionId>-<t>.<ext>` yang hanya bisa diputar pemilik atau guru berhak (dukung Range untuk
    Safari). Rute jawab menolak alamat rekaman milik pengerjaan lain (`rekamanMilikSendiri`). Dinilai manual (`butuhKoreksi`), batas
    durasi `kunci.durasiMaks` (15–600 dtk) ikut ke siswa lewat `soalUntukSiswa`. Mikrofon hanya jalan di HTTPS. Jendela izin mikrofon
    memanggil `tahanPengawasan` (src/lib/perangkat-ujian.ts) supaya tidak tercatat "pindah tab".
75. **Rapor format makro sekolah (22 September 2026) — keputusan user: "jangan buat aturan baru, ambil parameter dari data yang
    sudah ada".** Alur: guru mapel mengisi & MENGIRIM **Form Nilai Rapor** (`FormNilaiRapor`, satu baris per kelas × mapel ×
    semester; /dashboard/{teacher,admin}/form-nilai-rapor, bisa diisi dari Jurnal & CBT) → wali kelas mengisi **Isian Rapor**
    (/dashboard/teacher/rapor-kelas/isian: predikat sikap SB/B/C/K + perilaku menonjol, sikap Diniyah Kelakuan/Kerajinan/Kerapian,
    Naik/Tinggal atau Lulus/Tidak Lulus di semester genap — disimpan di `CatatanWaliKelas`) → kunci → pengesahan → **Cetak Rapor**
    (/dashboard/teacher/rapor-kelas/cetak & /dashboard/admin/rapor-cetak, `?jenis=akhir|ts|diniyah`).
    - Rumus = tiruan makro, SATU sumber: `src/lib/rapor-form.ts` (LM, RPH, HPA berbobot 50/20/30/0, predikat >89 A >79 B >69 C,
      deskripsi formatif/sumatif, katrol `KKM + x·(100−KKM)/100` — STS tidak pernah dikatrol), `src/lib/rapor-sikap.ts` (kalimat
      sikap & kalimat baku), `src/lib/terbilang-arab.ts`. Data cetak satu kelas: `susunRaporKelas` (src/lib/rapor-cetak.ts) — hanya
      form berstatus DIKIRIM yang dibaca. Diuji 1520/1520 sel sama dengan berkas Excel makro.
    - Cetak = `LembarBerhalaman`: blok diukur di browser lalu disusun ke lembar A4 tetap, kaki halaman per siswa + nomor halaman buku
      rapor (4 hal/semester: X-1→1 … XII-2→21; TS 2 hal/semester). Jarak antarblok WAJIB padding (bukan margin). Lembar di dalam
      SATU wadah `.print-doc` — memberi `.print-doc` pada tiap lembar menumpuk motif kertas `fixed` sebanyak jumlah lembar.
    - Selama wali kelas mengunci nilai (#43), simpan/kirim Form Nilai Rapor ditolak 409; isian wali ditolak setelah disahkan.
      Tanda tangan Kepala Sekolah (`letterhead.ttdKepalaSekolah`) hanya tercetak bila rapor sudah disahkan.
    - Nama Arab mapel Diniyah = `Subject.namaArab` (Data Mapel). P5 tidak dipakai sekolah — jangan dibuat.
    - **Halaman Depan** (`?jenis=depan`, lembar HAL.1-2 & HAL.3 makro): sampul (Garuda `public/images/garuda-pancasila.png`), i Identitas
      Sekolah (setelan Nominatif & Kontak), ii Petunjuk Pengisian, iii Keterangan Diri (Buku Induk lewat getter `SISWA_COLUMNS`,
      `susunHalamanDepan` di src/lib/rapor-depan.ts), Pindah Sekolah keluar/masuk, Catatan Prestasi — satu `DokumenCetak` per halaman,
      bisa dipilih. Data yang tidak ada di situs dicetak bertitik (diisi tangan), bukan dikarang. Pita navy kop diberi motif SMK (`PolaNavy`).
    - Superadmin mengisi/mencetak rapor lewat portal admin: /dashboard/admin/rapor-kelas (komponen bersama `RaporKelasManager`
      `portal="admin"`, isian di /dashboard/admin/rapor-kelas/isian). Siswa & orang tua melihat rapor format sekolah di
      /dashboard/{student,parent}/rapor/sekolah — hanya semester yang sudah disahkan, dan HANYA baris siswa itu yang dikirim ke browser.
    - **Wali kelas boleh MENGEDIT form setelah DIKIRIM** (permintaan user 22 Sep 2026; selama DRAF form dipegang guru — simpan
      otomatis keduanya bisa saling menimpa). Setiap perubahan oleh selain guru pengampu pada form DIKIRIM dicatat per sel di
      `FormNilaiRapor.riwayatWali` (`bedaForm` + `tambahRiwayat`, src/lib/rapor-form.ts; simpan beruntun ≤30 menit digabung) dan
      tampil di form guru ("Diubah setelah dikirim …"). Jalur simpan baru untuk form WAJIB lewat PUT /api/rapor/form/isi supaya
      riwayat ini tidak terlewat.
    - **Leger Nilai Rapor** (/dashboard/{teacher,admin}/rapor-kelas/leger, Excel /api/rapor/leger): hitungan murni `legerRapor`
      (src/lib/leger-rapor.ts) dari `susunRaporKelas` — layar & Excel selalu sama; Diniyah terpisah, tidak ikut peringkat.
76. **Singkatan mapel (22 September 2026) — `Subject.singkatan`, diisi lewat Data Mapel → Singkatan Mapel (satu isian per NAMA
    mapel, disimpan ke semua baris bernama sama).** Kepala kolom DKN & leger/ringkasan Rekap Nilai (layar + Excel) memakai
    `labelMapel(nama, peta)` dengan keterangan `keteranganSingkatan` di bawahnya; peta dari `petaSingkatanMapel` (server).
    Isian kosong = SARAN OTOMATIS (`saranSingkatan`, lewat `petaSingkatanMapel`) — permintaan user 22 Sep 2026 "kok nama mapel bukan
    singkatan"; isian form selalu menang. Keterangan singkatan wajib ikut di bawah tabel/cetakan.
77. **Mapel gabungan DPK 1–4 & KK 1–4 (22 September 2026) — `src/lib/mapel-gabungan.ts`.** Keputusan user: bagiannya tetap mapel
    sendiri di Penugasan Mengajar & Form Nilai Rapor (tiap guru mengisi/mengirim formnya), tetapi **rapor, leger, dan DKN memakai SATU
    mapel** "Dasar-Dasar Program Keahlian" (DPK) / "Konsentrasi Keahlian" (KK, kode makro). Nilai gabungan = **"Gabung LM & TP"**
    (`gabungForm` + `hitungSiswaGabungan`, src/lib/rapor-form.ts): semua LM/TP bagian jadi LM/TP satu mapel, nilai LM & SAS dipakai
    setelah katrol bagiannya masing-masing, STS/SAS = rata-rata bagian, KKM = rata-rata. Hanya bagian yang sudah DIKIRIM ikut;
    kolom leger bertanda * sampai SEMUA bagian terkirim (`BarisNilai.anggota`). **DKN: kolom gabungan TERISI OTOMATIS** dari nilai
    rapor gabungan (cadangan: rata-rata DKN bagian lama), tampil miring; ketikan wali (Grade DKN bernama grup) menimpa, mengosongkan
    sel = DELETE → kembali otomatis. Kolom DKN lain tetap murni manual. Tempat baru yang menampilkan mapel per kelas di dokumen
    rapor/rekap WAJIB memakai `namaGabungan`/`grupMapel`, jangan menampilkan bagian satu per satu.
78. **Aplikasi MyAlwis Mobile (Android, v2.1, 22–23 September 2026) — SATU aplikasi untuk seluruh portal, terkunci HANYA saat ujian.**
    Keputusan user: "aplikasi tidak fokus ke ujian saja … kalau sudah masuk ujian baru otomatis terkunci". Sumber `android-ujian/`
    (WebView Java tanpa pustaka). MODE BIASA: mulai di /login, unduhan (DownloadManager + cookie), `window.print` → dialog cetak
    Android, kamera (pindai QR), lokasi, unggah berkas, tautan luar dibuka di aplikasi lain. MODE UJIAN dinyalakan HALAMAN PENGERJAAN
    (`/ujian-online/[id]`) lewat `window.AplikasiSMK.modeUjian(true)` selama `m && !m.submitted` dan dimatikan saat dikumpulkan/unmount
    (+ jaring pengaman URL di aplikasi): layar disematkan (`startLockTask`), `FLAG_SECURE`, tautan luar diblokir, keluar wajib PIN
    `ujian.pinAplikasi` (/api/ujian/aplikasi/keluar, dibatasi per IP). User-Agent `MyAlwisMobile/<versi>` (`lewatAplikasi`,
    src/lib/aplikasi-ujian.ts; penanda lama `SMKAlMunawwirApp` & `SMKUjianApp` tetap dikenali — jangan dihapus, aplikasi lama
    masih terpasang di HP): halaman /login memakai tampilan yang sama di situs & aplikasi (navy + logo bercincin emas + kartu
    putih, TANPA navbar di keduanya), ajakan pasang PWA disembunyikan di aplikasi, `Exam.wajibAplikasi` menolak join
    dari browser HP Android (komputer & iPhone lolos). Push web TIDAK jalan di WebView, jadi sejak v2.2 aplikasi
    MENGAMBIL SENDIRI kabar tiap ±15 menit (`LayananKabar.java`, JobScheduler bawaan — BUKAN WorkManager/AndroidX, supaya APK
    tetap ±140 KB) dari `GET /api/aplikasi/notifikasi` memakai cookie sesi WebView, lalu memunculkannya sebagai notifikasi
    Android. Endpoint itu SENGAJA ringan (2 kueri berindeks, maks 5 butir) dan TIDAK menandai dibaca; id yang sudah ditampilkan
    diingat di SharedPreferences aplikasi. Notifikasi DIAM selama mode ujian (`MainActivity.UJIAN_BERLANGSUNG`), dan ketukan
    notifikasi membuka `url`-nya di dalam aplikasi (`bukaDariNotifikasi`). Kotak notifikasi (lonceng) tetap jalan.
    APK dibangun `android-ujian/bangun-apk.sh` (Docker `ghcr.io/cirruslabs/android-sdk:34` + Gradle 8.10.2 disinggahkan) →
    `public/unduh/myalwis-mobile.apk` (tidak masuk git; salinan nama lama tetap disimpan untuk tautan yang sudah dibagikan).
    **SATU halaman aplikasi: `/pasang-aplikasi`** — unduh APK + pasang versi browser (PWA) + petunjuk per perangkat + QR bagikan;
    `/aplikasi` & `/aplikasi-ujian` mengalihkan ke sana (23 Sep 2026, user: "kok double jadinya"). Nama dipilih user 23 Sep 2026
    ("Alwis" = julukan sekolah): NAMA_APLIKASI "MyAlwis Mobile", label peluncur & `short_name` PWA "MyAlwis" (Android memotong
    label >±12 huruf). Ganti nama = strings.xml, manifest.ts, src/lib/aplikasi-ujian.ts, dan teks halaman — semuanya lewat
    konstanta `NAMA_APLIKASI` bila memungkinkan.
    **Kunci rilis `/root/.cache/android-ujian/kunci-rilis.jks` + `sandi.txt` DI LUAR repo & WAJIB dicadangkan.** Rilis baru: naikkan
    versionCode/versionName (app/build.gradle), `VERSI` (MainActivity) & `VERSI_APLIKASI`. Sebelum membuka pemilih berkas di mode
    ujian, aplikasi memanggil `window.__ujianAplikasi.tahan()` (src/lib/perangkat-ujian.ts) — tombol unggah di browser pun sama.

79. **Layar/TV sekolah (Papan & TV, 24 September 2026) — dipantau LEWAT ROUTER, tanpa aplikasi di TV.** Sekolah memasang TCL
    55P6L (Google TV) di kelas dan TV itu **alat mengajar serbaguna — JANGAN dikunci kiosk**. Model `Layar` menyimpan daftarnya;
    status hidup/mati, IP, dan jaringan dibaca dari MikroTik (`withMikrotik`, src/lib/layar-server.ts: `daftarLayar`,
    `kandidatPerangkat`) lalu dicocokkan lewat **MAC**. Halaman `/dashboard/{admin,teacher}/papan-tv` (`PapanTvManager`,
    jabatan Sarpras/Kepala Lab lewat `aksesSarpras`). Yang perlu diingat:
    - **Jumlah TV & ruang berubah-ubah** — jangan pernah menulis daftar TV/ruang di kode. Perangkat yang terlihat router muncul
      sebagai kandidat, ruang diambil dari `daftarRuang()` yang sudah ada. TV dilepas = `aktif=false`, BUKAN dihapus (rekap
      bulan sebelumnya harus tetap sama).
    - **MAC acak**: Android mengacak MAC per WiFi (oktet pertama bit 0x02 menyala → `mungkinMacAcak`). Binding/sewa statis yang
      memakai MAC acak berhenti berlaku diam-diam saat TV menyambung ulang. Selalu minta petugas mematikan MAC acak di TV dulu.
    - **Kolom `age` sewa DHCP TIDAK ada di API RouterOS** (hanya di CLI `print detail`) — pakai `last-seen`.
    - Router dihubungi lewat `MIKROTIK_*` di `.env` (API di port khusus, bukan 8728 bawaan). Kalau router tak terjangkau, halaman
      tetap tampil dengan status OFFLINE — jangan membuat halaman gagal total karena router mati.
    - Perangkat hotspot punya DUA cara sah berinternet: login (`authorized`) ATAU **dilewatkan lewat IP binding**
      (`bypassed`). TV sekolah memakai yang kedua, jadi `authorized:false` pada TV ber-binding BUKAN masalah —
      `BELUM_LOGIN` hanya untuk yang tidak keduanya (temuan user 24 Sep 2026: TV Lab TKJ tertulis "belum login"
      padahal ping & ADB-nya tembus).
    - Aktivitas TV dibaca dari tabel hotspot TANPA aplikasi: `idle-time` (diam berapa lama → "menyala tapi tidak
      ditonton"), `bytes-in/out`, `uptime`.

    **Pantau visual & kendali lewat ADB (`src/lib/layar-adb.ts`, rute `/api/sarpras/layar/[id]/{tangkapan,perangkat,aksi}`):**
    tangkapan layar TV, nama aplikasi yang sedang dibuka, dan tombol daya/beranda/bisu — tanpa memasang aplikasi di TV.
    - Syarat di TV, SEKALI per perangkat: Opsi Pengembang → Debugging jaringan, lalu **setujui dialog izin di layar TV**
      (centang "Selalu izinkan"). Izin terikat pada KUNCI klien; kunci disimpan di volume `adb_keys` (docker-compose)
      supaya tidak hilang tiap deploy — kalau volume itu dihapus, semua TV minta izin ulang.
    - `adb` dipasang di image (Alpine `android-tools`, ±2 MB) karena aplikasi berjalan di kontainer.
    - **Batas yang jangan dijanjikan lebih:** aplikasi ber-DRM (Netflix dsb.) & input HDMI menghasilkan tangkapan layar
      HITAM; saat TV standby WiFi-nya mati sehingga ADB tidak menjawab sama sekali. **Wake-on-LAN lewat WiFi TERBUKTI
      GAGAL (diuji 24 Sep 2026)** — menyalakan TV dari jauh hanya mungkin lewat kabel LAN atau colokan pintar.
    - Setiap tangkapan layar & perintah tombol WAJIB dicatat `logActivity` — fitur ini untuk menindak laporan, bukan
      merekam diam-diam. Penyegaran berkala di Dinding Layar sengaja OPT-IN dan berhenti saat halaman ditinggalkan.

80. **Mode Ujian Jaringan (24 September 2026) — `src/lib/jaringan-ujian.ts`, halaman /dashboard/admin/jaringan-ujian.**
    Saat ada siswa yang SEDANG mengerjakan CBT, router menutup hiburan di jaringan siswa; selesai ujian, dibuka lagi
    sendiri. Aturannya:
    - **Pemicu = pengerjaan aktif, BUKAN jendela ujian.** Jendela SAS bisa terbuka berhari-hari (21–24 Sep), memakai
      jendela berarti hiburan mati tiga hari. Dipakai: `ExamAttempt` belum dikumpulkan & berdenyut dalam `tenggang` menit.
    - **Aturan dibuat SEKALI lalu dinyalakan/dimatikan**, tidak dibuat-hapus tiap kali — menyisipkan aturan baru
      berulang mengacak urutan firewall yang sudah jalan. Penanda kepemilikan HANYA komentar berawalan `SMK-UJIAN`;
      jangan pernah menyentuh/menghapus aturan dengan komentar lain.
    - Blokir memakai `tls-host` + **tutup QUIC (UDP 443)**. Tanpa menutup QUIC, YouTube lewat jalurnya sendiri.
    - **Bawaannya MATI** (SiteSetting `jaringan.ujianMode`) — fitur ini mengubah internet satu sekolah, tidak boleh
      menyala diam-diam. Disinkronkan `instrumentation.ts` tiap 2 menit; mode MATI tetap memastikan aturan padam.
    - Akses halaman & API lewat `assertJaringan` (jabatan pengelola jaringan), dicatat `logActivity`.

81. **Papan informasi TV & aplikasi TV sendiri (24 September 2026).** Halaman `/layar/<token>` (token acak per layar,
    dibuat dari Papan & TV — TANPA login karena TV tidak bisa mengetik sandi) + APK **MyAlwis Papan**
    (`android-papan/`, 130 KB, WebView layar penuh, kunci penandatangan sama dengan MyAlwis Mobile). Aturannya:
    - **Alamat dikirim dari dashboard, tidak ditanam di kode**: `am start -n sch.almunawwir.papan/.MainActivity
      -e alamat "<url>"`. Aplikasinya SENGAJA serbaguna — TV yang sama bisa menampilkan papan informasi ATAU
      layar presensi QR. Alamat disimpan di aplikasi, jadi setelah TV dinyalakan ulang papan kembali sendiri.
    - **Papan dikunci setinggi layar** (`h-dvh overflow-hidden`), isi dibagi EMPAT panel (Jadwal · Pengumuman ·
      Agenda · Bel) dengan kop logo PANJANG + jam tetap di atas. Jangan memakai `min-h-dvh`: isi yang panjang
      menjuntai ke bawah dan tidak pernah terlihat karena tidak ada yang menggulir TV di dinding.
    - Halaman layar publik (`/layar`, `/layar-kegiatan`, `/hadir`) WAJIB masuk `HIDDEN_PREFIXES` di
      `WhatsAppButton.tsx` — tombol melayang apa pun tidak boleh muncul di papan dinding.
    - **Buka otomatis** (`bukaPapanOtomatis`, src/lib/layar-jadwal.ts) hanya berjalan bila aplikasi depan TV
      adalah PELUNCUR (beranda). Kalau guru sedang memakai TV, sistem TIDAK BOLEH merebut layar.
    - **Tiga setelan tidur TV yang berbeda** dan menu Google TV hanya memperlihatkan sebagian: screensaver,
      `screen_off_timeout` (paling sering jadi biang), dan `sleep_timeout`. Dimatikan lewat ADB:
      `settings put secure sleep_timeout -1; settings put system screen_off_timeout 2147483647`.
    - **Mode daya TV menentukan bisa-tidaknya dinyalakan dari jauh.** Mode "Tanpa layar" = sistem tetap hidup →
      ADB menjawab dan `KEYCODE_WAKEUP` menyalakan layar (dibuktikan 24 Sep 2026: Awake → Asleep → Awake).
      Mode Doze = TV benar-benar tidur, Wake-on-LAN lewat WiFi TERBUKTI GAGAL. Jadwal nyala otomatis hanya
      berlaku untuk TV bermode "Tanpa layar".
    - **Sebagian TV mencemari keluaran `screencap`**: Polytron mengawali PNG dengan 65 byte log pabrikan
      ("Init wrapper sys mutex successful…"), sehingga berkasnya ditolak browser dan tampak seperti "TV tidak
      menjawab". Gambar WAJIB dicari dari TANDA TANGAN PNG-nya, bukan diandaikan mulai di byte pertama.
    - **`<img>` tidak bisa membaca badan balasan galat.** Saat gambar gagal, klien HARUS menanyakan ulang
      alasannya lewat fetch — dua kali kejadian pesan menyesatkan (ADB menunggu izin, DVR menjawab 403).
    - CCTV Dahua: **403 = akun tidak berwenang**, bukan sandi salah. Yang dipakai harus akun LOKAL DVR
      (biasanya `admin`), bukan akun aplikasi HP (DMSS/Imou, berupa email).

82. **Papan ruang guru = panel BERGILIR (`Layar.papanJenis = "GURU"`, 25 September 2026).** Ruang rapat & ruang guru
    tidak punya jadwal pelajaran, jadi papan di sana menampilkan "apa yang hari ini belum diisi" — presensi pegawai,
    jurnal mengajar, absensi kelas, buku piket, rekap kehadiran siswa — satu panel besar sekali tayang, berganti tiap
    `papanGiliran` detik (bawaan 120). Aturannya:
    - **Satu sumber angka: `susunPapanPegawai` (src/lib/papan-pegawai.ts)**, dan angkanya sengaja memakai kueri yang
      SAMA dengan pengingat terjadwal & badge notifikasi (`getClassesMissingAttendance`, jadwal BLOK + minggu A/B,
      `TeacherScheduleAttendance`, cakupan pegawai `role in [TEACHER, TAS]` seperti halaman Presensi Pegawai). Papan
      yang menunjukkan angka berbeda dari HP guru lebih buruk daripada tidak ada papan.
    - **Jenis papan DIPILIH petugas, jangan ditebak dari nama ruang.** Panel ini menyebut NAMA GURU yang belum
      mengisi, sehingga tidak boleh tampil di TV kelas/koridor. `/api/layar/[token]/pegawai` menolak token layar yang
      `papanJenis` ≠ GURU — tautan papan kelas yang beredar di grup siswa tetap tidak bisa membacanya.
    - **Data disegarkan lewat fetch, papan TIDAK memuat ulang halaman.** Memuat ulang mengembalikan giliran ke panel
      pertama dan menyentak layar di dinding.
    - **Tidak ada nama siswa.** Kehadiran siswa hanya angka rekap sekolah, sama seperti papan umum.
    - Hari libur (`cekLibur`) menggantikan panel pegawai dengan satu kartu keterangan; agenda & pengumuman tetap
      berputar. Ukuran huruf `clamp(… vh …)` seperti papan induk — armada TV bercampur resolusi.

83. **Papan TV dibuka LEWAT APLIKASI, bukan peramban (25 September 2026).** `bukaAlamat` (src/lib/layar-adb.ts)
    mencoba `am start -n sch.almunawwir.papan/.MainActivity -e alamat <url>` DULU, peramban hanya cadangan —
    peramban TV menambahkan bilah alamat & penunjuk tetikus di atas papan, dan halaman web tidak bisa
    menyembunyikan keduanya (laporan user dua kali: "masih muncul alamat di atas"). Berlaku sekaligus untuk buka
    papan manual, perintah massal, dan penjadwal otomatis. Tombol **Pasang aplikasi papan** di Dinding Layar
    memasang `public/unduh/myalwis-papan.apk` lewat `adb install -r`.
    - **Tangkapan layar HITAM = tayangan berproteksi, bukan TV rusak.** YouTube/Netflix/HDMI memakai jalur video
      terlindungi. Di bawah ~40 KB untuk 1080p pasti bingkai kosong, jadi `tangkapLayar` MENYEBUTKAN aplikasi yang
      sedang dibuka (status `TERPROTEKSI`) alih-alih mengirim kotak hitam — justru itu yang dicari sekolah.
    - **Mode Terima Layar** (`modeTerimaLayar`) membuka penerima Miracast TV (TCL: `com.tcl.miracast`) supaya
      petugas tidak perlu remote, lalu `tahanPapanOtomatis(id, 60)` menahan papan 1 jam. **Miracast = Wi-Fi Direct,
      hanya laptop Windows**; macOS tidak mendukungnya sama sekali — MacBook memakai Google Cast (port 8008/8009
      TV terbuka). Gagal mencerminkan layar didiagnosis dari `dumpsys wifip2p`: `groupFormed: false` +
      `mSavedPeerConfig` kosong = laptop tidak pernah menghubungi TV, bukan masalah di TV atau papan.
    - **Daftar berjadwal di papan memakai JENDELA, bukan `slice(0, n)`** (`jendela()` di PapanLayar): mulai satu
      baris sebelum yang akan datang. Dengan `slice` polos, jadwal & bel sore tidak pernah muncul seharian karena
      enam baris pertama sudah lewat semua (temuan user: "jam yang ke-6 09.45 kok tidak muncul"). Penanda "KINI"
      memakai indeks ABSOLUT (awal jendela + i), bukan indeks potongan.

84. **Volume TV otomatis saat bel (`Layar.volumeBel`, 25 September 2026).** Permintaan user: "saat bel hidup
    otomatis volume 100 dan ketika mati kembali volume sebelumnya". Halaman web TIDAK BISA melakukannya —
    `HTMLMediaElement.volume` hanya meredam suara halamannya sendiri, bukan volume perangkat; jalurnya ADB
    (`bacaVolume`/`aturVolume` di layar-adb.ts, `cmd media_session volume --stream 3`; perintah `media volume`
    TIDAK ADA di TV sekolah). Satu sumber logika: `src/lib/volume-bel.ts`.
    - **Dinaikkan 15 DETIK SEBELUM bel**, bukan saat bel berbunyi: perintah ADB perlu 1–3 detik, dan yang paling
      perlu terdengar justru detik-detik pertama.
    - **Dikembalikan setelah suaranya benar-benar habis** — `playBellAudio` sekarang mengembalikan Promise yang
      selesai pada event `ended` (berkas rusak → nada bawaan lalu tetap selesai, jadi volume tidak pernah
      tertinggal keras).
    - **Volume semula disimpan SEKALI.** Bel beruntun tidak boleh menyimpan "100" sebagai nilai semula. Nilai 0
      (TV sengaja dibisukan) tetap dihormati — penanda "belum disimpan" adalah ketiadaan entri, bukan angka 0.
    - **Selalu ada pengembalian cadangan** (3 menit) kalau papan mati/lepas jaringan di tengah bel.
    - Kosong = volume TV tidak pernah disentuh. Angka di formulir adalah PERSEN, diskalakan ke `Max` perangkat
      (TCL & Polytron sekolah memakai skala 0–100, tetapi jangan diasumsikan — `Max` dibaca dari `dumpsys audio`,
      dan blok `STREAM_MUSIC` wajib dilingkupi dulu karena dumpsys memuat belasan stream).

85. **Jaringan & Layar = SATU menu (27 September 2026).** Permintaan user: "kenapa fitur papan & tv, perangkat
    jaringan, dan jaringan sekolah, tidak dijadikan 1 saja dan yang bisa di ringkas". Empat menu lama (Papan & TV,
    Perangkat Jaringan, Jaringan Sekolah, Mode Ujian Jaringan) dilebur ke `/dashboard/{admin,teacher}/jaringan`
    (`PusatJaringanManager`) berisi pita tab: Layar & TV · Perangkat · Router & Hotspot · Mode Ujian · Setelan Router.
    - **Yang digabung hanya KERANGKAnya.** Tiap bagian tetap komponen yang sudah berjalan (`PapanTvManager`,
      `PerangkatJaringanManager`, `JaringanManager`, `JaringanUjianManager`), dipasang dengan prop **`tanpaKerangka`**
      yang melepas `PageHeader` + padding halaman supaya tidak dobel. Menulis ulang isi keempatnya hanya demi
      keseragaman tampilan akan mengorbankan fitur yang sudah terbukti di lapangan. Manager lain yang mau dilebur ke
      satu halaman memakai prop yang sama, jangan bikin nama baru.
    - **Hak akses per tab berbeda dan itu disengaja**: Layar & Perangkat = `aksesSarpras().kelola`, tiga sisanya =
      `bolehJaringan()` (varian tanpa lemparan dari `jaringan-guard.ts`). **Jangan memakai `aksesSarpras().masuk`
      sebagai gerbang pengelolaan** — nilainya `true` untuk SETIAP guru & staf (itu gerbang "boleh melapor
      kerusakan", CLAUDE.md #47). Tab yang tidak berhak TIDAK dirender (bukan disembunyikan CSS), dan tiap API di
      belakangnya tetap memeriksa haknya sendiri — halaman gabungan bukan pengganti penjaga.
    - Tab aktif ada di `?bagian=layar|perangkat|router|ujian|setelan` (`router.replace`, bukan `push`, supaya tombol
      kembali peramban tidak menelusuri tiap tab). Tiga rute lama tetap hidup sebagai **pengalihan** ke tab yang
      sesuai — tautan di catatan petugas, penanda peramban, dan `url` notifikasi lama tidak mati.
    - **Sambungan router bisa diisi dari halaman** (`src/lib/router-setelan.ts`, tab Setelan Router): alamat/port/
      pengguna di SiteSetting `jaringan.routerHost|routerPort|routerUser`, sandi di `jaringan.routerSandi`
      TERENKRIPSI AES-256-GCM berkunci turunan `SESSION_SECRET` — pola persis `dapodik.kunci`. `.env`
      (`MIKROTIK_*`) tinggal cadangan bila baris DB kosong; isian dikosongkan = baris dihapus = kembali ke `.env`.
      **Kotak sandi kosong berarti "jangan diubah", bukan "hapus"** — menghapus sandi harus ditekan tegas, kalau
      tidak sekali simpan setelan lain akan diam-diam memutus sambungan router. Sandi TIDAK PERNAH dikembalikan ke
      browser maupun masuk `logActivity`; balasan hanya menyebut ada/tidaknya. `withMikrotik` membaca setelan ini
      (disinggahkan 30 detik, dibuang `lupakanSetelanRouter()` saat disimpan) — jadi **jangan lagi membaca
      `process.env.MIKROTIK_*` langsung** di modul baru. Simpan selalu diikuti uji sambungan, supaya setelan salah
      terasa saat itu juga alih-alih muncul sebagai "Router tidak bisa dihubungi" di halaman lain.

86. **Patokan tampilan = Dashboard Kurikulum (27 September 2026).** Keputusan user: "patokan untuk semua
    halaman adalah dashboard kurikulum untuk beberapa aspeknya" — rinciannya di DESIGN_SYSTEM §19
    (`space-y-6`, baris pintasan, pita tab PUTIH BERGARIS dengan tab aktif navy, tabel dalam `panel` +
    `overflow-x-auto`, batang kemajuan tipis). Yang paling mudah terlewat: mengganti latar pita tab ke putih
    TANPA mengganti `hover:bg-white` pada tab non-aktif — hover putih di atas pita putih tidak terlihat sama
    sekali. `.page-card` sengaja TIDAK diseragamkan ke `.panel`: di layar keduanya sudah identik.
    **CCTV ikut dilebur ke Jaringan & Layar (#85) di dalam tab "Perangkat & CCTV"**, bukan tab sendiri —
    permintaan user: CCTV "dimasukkan ke perangkat jaringan dan teman-temannya tadi jadi satu". Tab itu
    tampil bila pengguna berhak SALAH SATU isinya (`hak: Hak[]`), dan tiap bagian di dalamnya disaring lagi:
    CCTV punya guard sendiri yang lebih sempit (`bolehCctv` — Kepala Sekolah, Wakasek Kesiswaan, Wakasek
    Sarpras), jadi jangan disamakan dengan `aksesSarpras().kelola`.

87. **Keseragaman tampilan punya PEMERIKSA sendiri: `node scripts/cek-keseragaman.mjs` (27 September 2026).**
    Rinciannya di DESIGN_SYSTEM §19.1. Jalankan pada berkas yang diubah sebelum build, bersama
    `cek-ikon-kembar.mjs` & `cek-tombol-kembali.mjs`. Pelajaran dari sapuan ini yang mudah terulang:
    - **Audit mentah selalu kelebihan hitung ±2×.** Dari 166 berkas yang ditandai, 89 ternyata sah
      (dokumen cetak, matriks padat, lingkaran penghitung, item sidebar, papan TV). Jangan pernah
      melaporkan angka audit mentah sebagai "sisa pekerjaan" — periksa berkasnya dulu.
    - **Regex per-atribut `className` melewatkan tombol.** Menyaring satu blok `className="…"` utuh
      melewatkan yang ditulis template literal (`` `btn-modal-cancel … ${x}` ``) dan yang kelasnya urut
      lain (`ml-1 p-1.5 …`). Pemeriksa ini memindai BARIS demi baris; itu yang menemukan 11 tombol
      terakhir setelah putaran pertama sudah "bersih".
    - **`h-screen` pada `<aside>` desktop WAJIB tetap** (§3.4) — yang diganti `dvh` hanya `min-h-screen`.
    - **Dokumen cetak jangan disentuh** (§17.4 butir 7): huruf 9–11px, kartu bergaris, dan tabel racikan di
      halaman cetak memang begitu supaya hasil cetaknya tidak berubah.
    - **Mayoritas bukan patokan.** Judul kartu portal mayoritasnya `font-bold` (160 tanda), tetapi
      `.panel-judul` dan Dashboard Kurikulum dua-duanya 600 — jadi yang 160 itu yang salah, dan 61 judul
      heading portal diturunkan ke `font-semibold` (DESIGN_SYSTEM §19.2). Situs PUBLIK tidak ikut: halaman
      pemasaran memang lebih tebal.
    - **Pesan "Belum ada…" punya dua bentuk baku** (DESIGN_SYSTEM §19.3): sebaris `text-sm text-gray-400`,
      blok tengah `py-10 text-center text-sm text-gray-400`. 96 pesan dengan 46 gaya diseragamkan. Dua
      kesalahan yang saya buat sendiri dan sudah diperbaiki, jangan diulang: (a) menambahkan
      `text-gray-400` tanpa memeriksa apakah elemen sudah punya warna LAIN → dua warna bertumpuk di satu
      elemen; (b) memakai `PrintKop`/`PrintButton` sebagai penanda dokumen cetak di pemeriksa → halaman
      layar yang kebetulan punya tombol cetak jadi kebal seluruhnya. Pengecualian cetak berlaku per BERKAS,
      jadi komponen campuran (layar + lembar cetak) tetap harus diperiksa manual.
    - **Spinner = abu ukuran 24 untuk BLOK memuat** (DESIGN_SYSTEM §19.4); yang SEBARIS menyesuaikan ikon
      sebelahnya, dan yang di dalam tombol gelap tidak diberi warna sama sekali.
    - **Jarak bawah blok wajib `mb-5`** untuk `kisi-kartu`/`baris-alat`/`alat-aksi justify-end` (§3.1 & §4.1);
      49 jarak `mb-3/4/6` diseragamkan. Blok di dalam wadah `space-y-6` tidak memakai `mb-*` sama sekali.

88. **Urutan & jarak isi halaman (27 September 2026, teguran user — DESIGN_SYSTEM §19.5).**
    `PageHeader` → pemberitahuan (bila ada) → **KARTU ANGKA** → pintasan → baris alat → isi.
    **Di halaman yang punya kartu angka, kartu WAJIB blok pertama**; tombol/pintasan/baris cari yang
    berdiri di atasnya terlihat melayang (laporan user: tombol "Inventaris Barang" sendirian di atas kartu
    Sarpras). Jarak antar blok dari SATU wadah `space-y-6`, bukan `mb-*` per blok — dengan `mb-*`, satu blok
    yang lupa diberi jarak langsung menempel ("sangat mepet"). Kesalahan saya yang memicu teguran ini:
    menyisipkan baris pintasan tepat di bawah `PageHeader` di 5 dashboard, padahal patokan Kurikulum
    menaruhnya SETELAH kartu; dan meninggalkan panel "Pintasan Kesiswaan" lama sehingga tautannya dobel.
    Periksa dengan `node scripts/cek-keseragaman.mjs` (aturan `urutan-kartu-dulu`).

90. **Portal yang menyuruh "gunakan menu di sidebar" = jalan buntu di HP (28 September 2026).**
    Laporan user: akun Kepala UKS & Tim Perpustakaan masuk lalu hanya melihat kartu sambutan, dan
    "dipencet apapun navbar bawah" tidak terjadi apa-apa. Empat dari LIMA akun role TAS kena
    (hanya pemegang jabatan TU penuh yang lolos). Tiga sebabnya, semuanya varian dari satu
    kesalahan — **tautan yang ditulis mati ke halaman Tata Usaha, diberikan ke akun yang tidak
    berhak membukanya**:
    - `/dashboard/admin/page.tsx` cabang TAS non-TU hanya merender kartu "Gunakan menu di sidebar".
      Kalimat itu ditulis 10 Agustus 2026, SEBELUM keputusan 18 September yang memindahkan seluruh
      menu ke kisi di dashboard dan MENGHAPUS laci menu HP (#54). Di HP tidak ada sidebar sama
      sekali. Sekarang cabang itu merender `<MenuTas jabatanNames={…}>` — kisi yang sama dengan
      sidebar, sudah disaring jabatan.
    - `TasSidebar` `navBawah` menulis mati 4 tautan TU (Buku Induk, Surat, Presensi, Layanan)
      padahal komentarnya sendiri menjanjikan "dibangun dari `visibleGroups` yang SAMA". Keempatnya
      dijaga `verifyTasAccess()` → `redirect("/login")` → proxy melihat sesi masih sah → dilempar
      balik ke dashboard. **Memantul pulang terbaca pengguna sebagai "tombolnya tidak berfungsi",
      bukan sebagai penolakan akses** — itu sebabnya tidak ada yang melaporkannya sebagai error.
    - `MenuTas` pintasannya juga tertulis mati ke E-Arsip/Layanan Surat/Data Siswa.
    Aturan: **setiap daftar tautan tetap (bottom nav, pintasan, menu akun) di portal yang dipakai
    lebih dari satu peran WAJIB diturunkan dari daftar menu yang sudah disaring, bukan ditulis
    ulang.** Dan tautan "Profil"/"Portal Guru" di `TasSidebar` dipilih dari PERAN (`isGuru`), bukan
    dari `isFullTas` — dulu terbalik: guru-TU tidak diberi tautan Portal Guru sedangkan staf TAS
    malah diberi tautan portal guru yang menolak mereka. Memeriksanya: `role='TAS'` di DB, lalu
    pastikan tiap akun punya menu (13 menu `show: () => true` adalah lantai minimumnya).

89. **Ubin pintasan = `<BarisPintasan>` (src/components/shared/BarisPintasan.tsx), JANGAN salin markup**
    (27 September 2026 — DESIGN_SYSTEM §20). Markup yang sama sempat tersebar di 13 berkas dan bentuknya
    pelan-pelan berbeda. Token spasi & bentuk ada di blok "TOKEN PELENGKAP" globals.css; tinggi kartu
    seragam diurus `.kisi-kartu { align-items: stretch }`, bukan per halaman. **Fondasi token TIDAK
    dibuat ulang** — `@theme` yang ada sudah dipakai 272 halaman; membuat berkas variabel kedua akan
    menjadi sistem paralel yang bertabrakan.

91. **PKL punya DUA tabel dan jendela pendaftarannya kelas XI SEMESTER GENAP (29 September 2026).**
    `PklRegistration` = pendaftaran/usulan siswa; `Internship` = PENEMPATAN yang dicatat sekolah
    (satu baris per siswa, `@unique`). Keduanya jangan dicampur.
    - **Siapa boleh mendaftar diatur, bukan ditulis mati.** Route pendaftaran dulu menolak
      `grade !== 11` langsung di kode, dan tabel `PklDocumentRequirement` kosong sehingga formulirnya
      menampilkan "Belum ada dokumen syarat" — gabungan keduanya membuat **tidak ada satu pun siswa
      yang bisa mendaftar** (laporan user: "saya tidak melihat tempat untuk siswa dapat mendaftar").
      Sekarang lewat `izinDaftarPkl` (src/lib/pkl-pendaftar.ts) dengan SiteSetting
      `pkl.tingkatPendaftar` (bawaan "11") + `pkl.pendaftaranDibuka` (auto = ikut semester genap |
      buka | tutup), diatur di /dashboard/admin/pkl-pendaftaran → tab Dokumen Syarat → Jendela
      Pendaftaran. Aturan sekolahnya: **kelas XI pada semester genap**, sebelum naik ke kelas XII.
      Kelas XII TIDAK mendaftar lagi — mereka sudah peserta.
    - **Pendaftaran TIDAK boleh diblokir oleh daftar syarat yang kosong.** Bila tidak ada
      `PklDocumentRequirement` aktif, siswa cukup mengajukan tempat PKL. Yang ditolak dulu adalah
      `documents.length === 0`, jadi tabel kosong = pendaftaran mati total.
    - **Siswa HANYA mendaftar & melengkapi berkas.** Tempat PKL dan guru pembimbing ditetapkan
      Humas / bagian PKL lewat `Internship` — bukan diusulkan siswa (keputusan user 29 September
      2026). Kolom usulan tempat sempat dibuat lalu DICABUT; jangan dihidupkan lagi.
    - **Penempatan boleh belum pasti.** `Internship.company = "Belum ditentukan"`
      (`TEMPAT_BELUM_DITENTUKAN`/`penempatanBelumPasti` di src/lib/pkl-tempat.ts — netral, bukan
      `server-only`, supaya halaman klien bisa memakainya). Tombol **Masukkan Peserta PKL Massal**
      (/api/admin/internships/massal) memasukkan seluruh siswa aktif satu tingkat sekaligus dan
      **melewati** yang sudah punya baris PKL, jadi aman ditekan berulang tiap angkatan. Panel
      pendaftaran di portal siswa tampil selama `penempatanBelumPasti` — dulu syaratnya "belum punya
      baris PKL sama sekali", sehingga begitu peserta dimasukkan lebih dulu, formulirnya ikut hilang.

92. **Masukan Rekan = anonim TERHADAP PENERIMA, bukan anonim mutlak (29 September 2026).**
    Model `MasukanRekan` (kritik/saran/apresiasi antar pegawai). Kontraknya ada di
    `src/lib/masukan-rekan.ts` dan WAJIB dijaga oleh setiap route baru yang menyentuhnya:
    - **Route yang melayani PENERIMA tidak boleh menyertakan `pengirimId` atau relasi `pengirim`
      dalam `select`/`include`.** Menyembunyikannya di layar TIDAK CUKUP — datanya tidak boleh
      sampai ke browser penerima sama sekali. Cara memeriksanya: panggil `/api/masukan-rekan`
      sebagai penerima dan pastikan kunci yang kembali hanya `id, jenis, isi, dibacaAt, createdAt`.
    - **`/api/admin/masukan-rekan` satu-satunya jalur yang menampilkan pasangan pengirim–penerima**,
      dijaga `verifyRole(["ADMIN"])`. TAS dan guru berjabatan apa pun TIDAK diberi akses — seluruh
      nilai fitur ini bergantung pada pengirim tidak terlihat oleh rekan kerjanya.
    - Notifikasi ke penerima tidak menyebut pengirim.
    - **Layar pengirim menyatakan tegas bahwa Superadmin dapat melihat pengirimnya.** Jangan
      dihapus: menjanjikan anonim penuh padahal tidak, akibatnya lebih buruk saat ketahuan.
    - Batas 10 masukan/pengirim/hari, isi maks 2000 karakter.
    **Menguji anonimitas jangan lewat status HTTP saja** — `fetch` mengikuti pengalihan, jadi guru
    yang ditolak `verifyRole` tetap menerima **200** berisi HTML halaman portalnya. Periksa
    `redirect: "manual"` (harus `opaqueredirect`) atau isi badannya, bukan angka statusnya.

93. **Guru & staf mengelola biodatanya sendiri lewat PENGAJUAN (30 September 2026).** Padanan alur
    siswa: `/dashboard/{teacher,admin}/biodata` → `POST /api/pegawai/biodata/request` →
    `PegawaiEditRequest` → TU memutuskan di tab **"Guru & Staf"** pada
    `/dashboard/admin/verifikasi-data` → baru tersimpan. Satu pengajuan menunggu per akun (409 kalau
    masih ada yang PENDING), formulirnya terkunci selama menunggu, seperti siswa.
    - **Satu pintu baca/tulis: `src/lib/biodata-pegawai.ts`** (`bacaBiodataPegawai`,
      `terapkanBiodataPegawai`). Sumbernya `Teacher` (kolom scalar + `bukuIndukData`, sama dengan
      Buku Induk Guru). Akun **TAS tidak punya baris Teacher** (terukur 30 Sep 2026: 32 guru punya,
      5 TAS & 2 ADMIN tidak), jadi mereka memakai cadangan `BiodataPegawai` — dan begitu TU
      membuatkan baris Teacher-nya, `bacaBiodataPegawai` MEMINDAHKAN isinya lalu menghapus baris
      cadangan, sehingga tidak pernah ada dua salinan hidup. Jalur baru yang membaca/menulis biodata
      pegawai WAJIB lewat helper ini, jangan menyentuh `Teacher.bukuIndukData` langsung.
    - **JANGAN membuatkan baris `Teacher` untuk staf TAS supaya "seragam".** 22 dari 36 pemanggil
      `prisma.teacher.findMany()` tidak menyaring `teacherStatus`, jadi staf non-guru akan bocor ke
      daftar pengampu, beban mengajar, dan cetakan pembagian mengajar.
    - **Daftar isian diturunkan dari `GURU_COLUMNS`** (`c.isian` minus grup "Pindah / Keluar")
      ditambah beberapa kunci pribadi yang tak bertanda isian (`nik`, `maritalStatus`, `spouseName`,
      wilayah). Menambah isian Buku Induk Guru otomatis ikut ke formulir pegawai — itu sebabnya
      `IsianGrupGuru` (src/components/admin/IsianGrupGuru.tsx) diekstrak dari
      `BukuIndukGuruManager` dan dipakai keduanya. NIP, mata pelajaran, status kepegawaian, tanggal
      mulai, nama, dan jabatan struktural SENGAJA di luar jangkauan pegawai (wewenang TU) dan
      ditampilkan sebagai kartu "Data yang hanya bisa diubah Tata Usaha".
    - Badge "Perubahan data menunggu verifikasi" = SISWA + PEGAWAI dalam satu angka
      (`hitungPengajuanBiodata`) karena keduanya diverifikasi di halaman yang sama. Kalau menambah
      jenis pengajuan biodata baru, tambahkan ke fungsi itu juga, jangan hitung terpisah di layout.

94. **Pengajuan perubahan data diputuskan PER ISIAN, bukan sekali untuk semuanya (30 September 2026).**
    Permintaan user: "ada yang ditolak jadi tidak semuanya di approve karena kemungkinan ada yang salah
    datanya". Berlaku untuk pengajuan SISWA (`ProfileEditRequest`) dan GURU/STAF (`PegawaiEditRequest`):
    - `POST .../decide` menerima `tolak: string[]` = kunci isian yang DITOLAK; sisanya tetap diterapkan.
      Tanpa `tolak` perilakunya sama seperti dulu (setujui semuanya), jadi pemanggil lama tetap jalan.
    - Status akhir dari `statusKeputusan(diterima, ditolak)` di `src/lib/profile-edit-fields.ts`:
      semua diterima = `APPROVED`, sebagian = **`SEBAGIAN`**, tidak ada yang diterima = `REJECTED`.
      **Setiap kueri riwayat pengajuan WAJIB memakai `STATUS_SELESAI`**, jangan menulis
      `["APPROVED","REJECTED"]` lagi — kalau lupa, pengajuan yang disetujui sebagian HILANG dari
      riwayat pemohon dan mereka tidak pernah tahu isian mana yang ditolak.
    - Keputusan per isian disimpan DI DALAM `changes` (`ChangeEntry.ditolak = true`), bukan di kolom
      terpisah, supaya riwayat siswa/pegawai bisa menyebut isian yang ditolak satu per satu.
    - Layar TU: tabel Lama → Baru diberi kolom centang "Setujui" (tercentang semua di awal). Melepas
      centang = isian itu ditolak. Tombolnya ikut berubah jadi "Simpan N Isian, Tolak M".

95. **Izin keluar punya DUA wujud di portal siswa, ditentukan Guru Piket (30 September 2026).**
    Satu baris `IzinKeluarSiswa` + kolom `perluFoto`:
    - **`perluFoto = false`** → di `/dashboard/student/izin-keluar` izin itu hanya jadi **SURAT IZIN
      KELUAR**: identitas, keperluan, jam keluar, rencana kembali, nama guru piket, dan QR keaslian
      (pola #49, token dibuat sekali, verifikasi publik di `/verify/izin-keluar/<token>`). Untuk
      ditunjukkan ke petugas keamanan atau tempat tujuan.
    - **`perluFoto = true`** → surat yang sama PLUS kewajiban siswa mengunggah bukti foto dari tempat
      tujuan. **Suratnya tetap berlaku** — guru piket sudah mengizinkan; yang tertunda hanyalah
      buktinya, dan itu muncul sebagai lencana menu + antrean "Perlu tindakan" siswa.
    - Satu sumber status: `statusIzinKeluar()` di `src/lib/izin-keluar.ts` (`DI_LUAR` / `KEMBALI` /
      `BUKTI_TERTUNDA`) — dipakai layar siswa, Buku Piket, dan halaman verifikasi, jadi ketiganya tidak
      pernah menyebut hal berbeda untuk baris yang sama.
    - **Bukti foto masuk folder RAHASIA** `public/uploads/rahasia/izin-keluar` (bisa memuat informasi
      kesehatan, mis. izin ke klinik) — diblokir proxy, dibuka hanya lewat `/api/izin-keluar/[id]/bukti`
      dengan `bolehLihatBukti`. Batas unggah/ganti `JAM_BATAS_BUKTI` = 24 jam sejak keluar.
    - **Halaman verifikasi SENGAJA tidak menampilkan alasan keluar** — petugas keamanan cukup tahu surat
      itu asli, untuk siapa, jam berapa, dan statusnya. Alasan bisa menyangkut kesehatan/urusan keluarga.
    - Siswa TIDAK membuat izin sendiri; guru piket yang mencatat. Notifikasi `IZIN_KELUAR` dengan kunci
      `izin-keluar:<id>` memberitahu siswa bahwa suratnya sudah bisa ditunjukkan.

96. **Presensi imam sholat dicek DI BUKU PIKET, satu panel dengan kehadiran petugas piket
    (30 September 2026).** Permintaan user: "presensi jadwal imam sholat muncul di absensi yang di cek
    guru piket biar jadi 1". Yang berlaku sekarang:
    - **Jadwal** imam tetap disusun di `/dashboard/{admin,teacher}/imam-sholat` (`assertImam`:
      Kesiswaan / Pembina OSIS / Kepala Sekolah). **Tab "Presensi Harian" di halaman itu DIHAPUS** —
      jangan dihidupkan lagi; dua tempat pengisian untuk satu data berarti keduanya bisa berbeda.
      Halaman itu sekarang menautkan ke Buku Piket portal yang sama (`bukuPiketHref`, jangan
      menautkan portal guru ke rute admin — CLAUDE.md #45).
    - **Kehadirannya** diisi di panel "Kehadiran Guru Piket & Imam Sholat" pada Buku Piket
      (`KedisiplinanManager`), memakai `viewDate` yang sama, dengan SATU tombol Simpan.
    - **Tetap dua tabel di DB dan itu disengaja**: `DutyAttendance` unik per (userId, date),
      `PresensiImam` per (userId, date, sesi) — satu guru bisa piket pagi DAN jadi imam di hari yang
      sama. Karena itu Simpan mengirim dua permintaan (`duty-attendance` + `/api/imam/presensi`) dan
      melaporkan kegagalan masing-masing; jangan "menyederhanakan" jadi satu tabel.
    - **Guru piket harus boleh menyimpan presensi imam**, jadi `/api/imam/presensi` dijaga
      `assertPresensiImam` = `assertImam` ATAU `assertKedisiplinan` (salah satu lolos cukup).
      `assertImam` tetap khusus untuk MENGATUR jadwalnya.
    - Status imam hanya 4 (HADIR/IZIN/SAKIT/ALPHA) — **tanpa TERLAMBAT**, beda dari status guru piket.
      Mengirim TERLAMBAT ke `/api/imam/presensi` disaring diam-diam, jadi dropdown-nya memang dipisah
      (`STATUS_OPTIONS_IMAM`). Keduanya tetap default KOSONG (CLAUDE.md #10).

97. **Domain sekolah aktif: `https://smkalmunawwiriibs.sch.id` (30 September 2026).** Port 80/443 IP
    publik `103.194.175.54` diarahkan ke server situs (`172.15.0.3`) dan diterminasi **Caddy**
    (`/etc/caddy/Caddyfile`, layanan systemd di HOST — bukan di dalam Docker). Sertifikat Let's Encrypt
    otomatis & diperpanjang sendiri; tidak ada certbot yang perlu diurus.
    - **Caddy melayani TIGA nama**: situs sekolah (+`www`) → `127.0.0.1:3000`, `office.…` →
      `127.0.0.1:8090` (ONLYOFFICE), dan **`technofix-bill.duckdns.org` → `https://172.15.0.11`**.
      Nama ketiga itu milik penyewa lain di router yang sama; sebelumnya ia yang memegang 80/443.
      Meneruskannya membuat URL-nya tidak berubah sehingga **webhook pembayarannya tidak perlu
      didaftarkan ulang**. `header_up Host {host}` WAJIB — tanpa itu Apache di `.11` jatuh ke vhost
      bawaan dan menyajikan halaman "Koneksi Terisolir" (terbukti saat uji).
    - **Caddyfile TIDAK memakai `encode`** (Next sudah mengompres; lapis kedua menahan SSE papan
      pantau ujian) dan **tidak menyetel timeout baca** (sinkron Dapodik 20–47 dtk, long-poll sinyal
      25 dtk). Jangan menambahkannya.
    - **`pakaiSecure` tidak lagi memakai `NEXT_PUBLIC_APP_URL` sebagai cadangan.** Dulu cadangannya
      `NEXT_PUBLIC_APP_URL.startsWith("https://")`; begitu variabel itu diisi domain HTTPS, SELURUH
      jaringan sekolah yang memakai `:3000` tidak bisa login (cookie `Secure` ditolak di HTTP).
      Sekarang cadangannya `false`, karena request tanpa `X-Forwarded-Proto` memang datang langsung ke
      `:3000` yang selalu HTTP polos. Terverifikasi: HTTPS → `Secure` ada, `:3000` → tidak ada.
      **Alamat publik dan keamanan koneksi jangan disatukan lagi ke satu variabel.**
    - **Tailscale Funnel SENGAJA tetap hidup.** QR yang sudah tercetak dan APK v2.2 ke bawah yang sudah
      terpasang di HP menunjuk ke `smk-almunawwir.tail984090.ts.net`. Jangan dimatikan sebelum semua HP
      memasang v2.3. Jalur `:3000` juga tetap (dst-nat & filter "Website SMK Almunawwir" masih ada).
    - Empat aturan dst-nat yang diubah tercatat di scratchpad `nat-cadangan.json`; pengembalian =
      kembalikan `to-addresses` ke `172.15.0.11`.

98. **Notifikasi Android harus BERBUNYI: saluran notifikasi tidak bisa diubah, harus dibuat BARU
    (30 September 2026).** Saluran lama dibuat `IMPORTANCE_DEFAULT` — masuk diam-diam ke laci, tidak
    muncul menonjol. Android **membekukan setelan saluran saat pertama kali dibuat**: memanggil
    `createNotificationChannel` lagi dengan importance/suara berbeda TIDAK berpengaruh di HP yang sudah
    memasang aplikasi. Karena itu ID-nya diganti `kabar-sekolah` → **`kabar-sekolah-v2`** dengan
    `IMPORTANCE_HIGH` + suara notifikasi bawaan + getaran, ditambah `PRIORITY_HIGH` &
    `DEFAULT_SOUND|DEFAULT_VIBRATE` untuk Android < 26. **Kalau setelan bunyinya diubah lagi nanti,
    ganti lagi ID salurannya — jangan menyunting yang lama.** Push web (`public/sw.js`) tidak bisa
    menentukan bunyi (dipegang setelan peramban), tetapi `vibrate` + `silent: false` bisa dan itu yang
    paling terasa saat HP mode senyap.
    **Perbaikan ini HANYA sampai lewat pemasangan APK baru** — tidak bisa dikirim dari server ke
    aplikasi yang sudah terpasang. Memperbarui = pasang menimpa (package & kunci tanda tangan sama,
    data tidak hilang), tetapi **pengguna harus login sekali lagi** karena cookie sesi terikat origin
    lama (ts.net) dan tidak ikut pindah ke domain baru.

99. **Ajakan pasang aplikasi bercabang per perangkat (30 September 2026, permintaan user "langsung apk,
    kecuali iphone dan desktop").** `InstallPwaPrompt`: di **Android** tombolnya MENGUNDUH APK terbaru
    (`BERKAS_APK`) dan banner muncul tanpa menunggu `beforeinstallprompt` — versi Chrome (PWA) tidak
    punya mode ujian terkunci, notifikasi Android, dan dialog cetak, jadi di Android APK selalu yang
    benar. Di **iPhone & desktop** tetap memasang PWA dan hanya muncul bila browser menawarkannya.

100. **Kegiatan boleh BERHARI-HARI, dan presensinya diulang tiap hari (30 September 2026).**
     Permintaan user: "bisa tanggal berapa sampai berapa … misal MPLS 5 hari, hari pertama Pra MPLS,
     2-3-4 MPLS, hari 5 Penerimaan Tamu Ambalan".
     - `Kegiatan.sampaiTanggal` (tengah malam WIB hari terakhir, **null = satu hari** seperti dulu).
       Jam hariannya SAMA setiap hari, diambil dari `mulai`/`selesai`. Rangkaian seperti contoh MPLS
       dibuat sebagai beberapa kegiatan berjudul sendiri dengan rentangnya masing-masing.
     - **`PresensiKegiatan` unik per (kegiatan, orang, TANGGAL)**, bukan lagi per (kegiatan, orang) —
       tanpa itu satu orang hanya bisa tercatat hadir SEKALI untuk seluruh 5 hari. Tabelnya masih
       kosong saat diubah (0 baris), jadi tidak ada migrasi data.
     - **Jendela QR dihitung PER HARI** (`jendelaSekarang` di src/lib/kegiatan-qr.ts): tiap hari punya
       jendela `[jam mulai − 30 mnt, jam selesai + 30 mnt]` sendiri. Memakai satu rentang menerus akan
       membuat QR sah 24 jam nonstop selama lima hari. Jalur presensi baru WAJIB lewat fungsi ini,
       jangan membandingkan `mulai`/`selesai` langsung.
     - Rekap, catat manual, hapus, dan unduhan Excel semuanya berlingkup satu hari (`?tanggal=`),
       dengan pita tab "Hari 1 · Sen 30 Sep" di layar rekap saat kegiatan lebih dari sehari.
     - Batas 60 hari per kegiatan.
     - **Rekap dikelompokkan per KELAS dan satu kelompok "Guru & Staf"** (`kelompokDari`/`kelompokkan`
       di KegiatanManager), di tab Hadir MAUPUN Tidak Hadir, dengan hitungan "12 / 32 hadir" per
       kelompok — jadi "siapa yang tidak hadir di kelas mana" terbaca langsung. Excel-nya punya sheet
       **Ringkasan** (hadir/tidak hadir per kelas) + Hadir + Tidak Hadir, keduanya berkolom Kelas.
     - **Pencatatan manual bisa SEKELAS sekaligus**: `POST …/presensi` menerima `userIds: []` (maks 500)
       selain `userId` tunggal, dan tombol "Hadir semua (N)" ada di kepala tiap kelompok. Daftar id dari
       browser TIDAK dipercaya — disaring dulu ke `penerimaPengumuman(kegiatan)` supaya hanya sasaran
       kegiatan itu yang bisa dicatat (pola sama CLAUDE.md #10).
     - **Peserta boleh dipilih ORANG PER ORANG** (`Kegiatan.targetUserIds`, 30 September 2026) untuk
       kegiatan yang pesertanya bukan satu kelas utuh — panitia, perwakilan kelas, undangan terbatas.
       Semantiknya **MENANG atas saringan** peran/kelas/jurusan/jabatan: kalau daftar orang terisi,
       peserta PERSIS orang-orang itu. Menjumlahkannya dengan saringan akan membingungkan ("sudah pilih
       5 orang kok semua siswa jadi sasaran"), jadi di formulir saringan itu disembunyikan dan diganti
       keterangan tegas.
     - `penerimaPengumuman` menerima `targetUserIds` opsional, tetapi `rapikanSasaran` mengembalikannya
       sebagai field **terpisah** (`orang`), BUKAN di dalam `sasaran` — Announcement & Survei menyebar
       `...sasaran` langsung ke Prisma dan kedua model itu tidak punya kolom tersebut.
     - Daftar orang yang boleh dipilih DISARING DI SERVER menurut hak: guru biasa hanya pegawai, wali
       kelas ditambah siswa kelas walinya, pemegang hak pengumuman seluruh siswa aktif — di GET (apa
       yang dikirim ke browser) MAUPUN di POST (apa yang boleh disimpan).
     - **Kegiatan bisa DIUBAH** (`PUT /api/kegiatan/[id]`). Satu aturan yang dijaga: rentang tanggal tidak
       boleh dipersempit melewati hari yang SUDAH punya catatan kehadiran (409) — memotongnya menyisakan
       presensi yatim yang tidak bisa dilihat maupun dihapus lewat layar mana pun. Catatan hadir juga bisa
       diubah keterangannya (Hadir biasa / Izin / Sakit / Terlambat / Dispensasi) lewat tombol pensil;
       jalur simpannya upsert yang sama dengan mencatat manual.
     - **Hadir di kegiatan sekolah IKUT MENGISI ABSENSI HARIAN** (`hadirkanAbsensiHarian`,
       src/lib/absensi-otomatis.ts). Aturannya sama persis dengan pindai kartu gerbang (#33) & presensi
       pegawai (#52): hanya mengisi kalau hari itu BELUM ada catatan — keputusan wali kelas/TU tidak pernah
       ditimpa — dan hari libur dilewati (`cekLibur`). Pegawai lewat `catatPresensiPegawai(…, "KEGIATAN")`
       dan HANYA untuk hari ini, karena fungsi itu selalu bekerja pada hari berjalan; mengisi hari lampau
       tetap wewenang TU. Gagal di sini tidak boleh menggagalkan presensi kegiatannya (dibungkus `.catch`).
     - **Ketidakhadiran DIHITUNG, bukan disimpan** (`ketidakhadiranKegiatan`, src/lib/kegiatan-tidak-hadir.ts):
       sasaran kegiatan dikurangi yang punya baris presensi, dan HANYA untuk hari yang sudah lewat. Menyimpannya
       sebagai baris sendiri akan jadi sumber kedua yang bisa berbeda saat sasaran diubah atau catatan hadir
       dihapus. Tampil di `/dashboard/{student,parent,teacher,admin}/kegiatan-tidak-ikut` — SATU komponen,
       cakupannya ditentukan SERVER: siswa hanya dirinya, orang tua anaknya, wali kelas kelas walinya,
       Kesiswaan/BK & Admin semua. Tanpa pembatasan itu daftar "siapa bolos" seluruh sekolah terbuka untuk
       guru mana pun.

101. **Satu HP, dua jenis QR — pemindai Absen Mandiri WAJIB mengenali keduanya (1 Oktober 2026).**
     Laporan user: "saat absen kegiatan, peserta buka absensi mandiri, malah tertulis barcode tidak di
     gerbang, jadi tidak ada yang bisa scan." Penyebabnya: QR absensi gerbang/kelas berisi **TOKEN
     pendek** (`src/lib/absensi-qr.ts`), sedangkan QR presensi kegiatan berisi **ALAMAT**
     `…/hadir/<id>?t=<token>` (`/api/kegiatan/[id]/qr`). Layar Absen Mandiri mengirim apa pun yang
     terpindai ke `/api/student/absen-mandiri`, jadi QR kegiatan ditolak dengan pesan tentang gerbang.
     - Perbaikannya di KLIEN, bukan server: `jalurHadirKegiatan(teks)` (`src/lib/qr-tujuan.ts`, netral —
       bukan `server-only`) mengenali pola alamat itu, dan pemindai mengarahkan ke sana alih-alih
       mengirim ke endpoint gerbang. Dipasang di Absen Mandiri SISWA dan PEGAWAI.
     - **Alamat sengaja dikembalikan RELATIF terhadap origin yang sedang dibuka.** QR yang sudah
       tercetak/tertayang bisa memuat alamat terowongan lama (ts.net) sementara penggunanya masuk lewat
       domain sekolah — mengikuti alamat absolutnya melempar mereka ke origin tempat sesinya tidak
       berlaku, dan mereka diminta login lagi di tengah kegiatan.
     - Pemindai baru yang menerima QR dari sumber campuran WAJIB memakai fungsi ini dulu sebelum
       menebak jenis kodenya.

102. **Pusat SPMB — portal panitia penerimaan murid baru (1 Oktober 2026).** Permintaan user: "spmb khusus
     punya portal sendiri seperti ujian … portal untuk mensetting semua kebutuhan spmb baik yang muncul di
     web juga maupun yang nantinya data spmb masuk ke data sekolah". Rute `/pusat-spmb` (pola `PortalShell`
     sama Pusat Ujian), penjaga `src/lib/spmb.ts` → `JABATAN_SPMB` / `assertSpmb` / `bolehSpmb`.
     - **Keputusan bentuk (user, 1 Okt 2026):** pendaftaran **BERGELOMBANG**; komponen penilaian
       **ditentukan panitia** ("bisa disesuaikan dari semuanya pilihan"); calon mendaftar **TANPA AKUN**,
       dikenali **nomor pendaftaran + tanggal lahir** (nomor saja mudah ditebak orang lain).
     - Enam model baru: `GelombangSpmb` (+`KuotaSpmb` per jurusan), `KomponenNilaiSpmb` (+`NilaiSpmb`),
       `DokumenSyaratSpmb` (+`BerkasSpmb`). `Admission` dapat `nomor @unique` & `gelombangId`.
     - **Acuan nasional yang dipakai (riset 1 Okt 2026):** SPMB menggantikan PPDB sejak **Permendikdasmen
       No. 3 Tahun 2025**. Empat jalur resmi (Domisili/Afirmasi/Prestasi/Mutasi) berlaku SD–SMA; **untuk SMK
       TIDAK ada pembagian jalur baku** — seleksinya nilai rapor **semester 1–5**, **Tes Kemampuan Akademik
       (TKA)**, dan **pembobotan prestasi**. Karena itu daftar jalur di situs **diatur panitia**
       (`spmb.jalur`), bukan ditulis mati. **Kuota minimal jalur domisili & batas mutasi 5% TIDAK diterapkan**
       — itu mengikat sekolah NEGERI, sedangkan Al-Munawwir swasta berbasis pesantren.
     - **Jenis komponen `PRESTASI`**: panitia memilih **tingkat × peringkat** sertifikat, `nilai` dihitung
       **SERVER** dari `spmb.bobotPrestasi` (jadi tidak bisa dikarang dari browser) dan disimpan bersama
       kolom `NilaiSpmb.tingkat/peringkat` supaya bisa diaudit. Bawaan tabelnya pola juknis daerah:
       berjenjang naik 2× tiap tingkat, turun separuh tiap peringkat (Juara I 16/32/64/128). Angkanya
       kewenangan sekolah — jangan dikunci di kode.
     - **Skor** (`hitungSkorSpmb`): bobot dinormalkan terhadap komponen yang BENAR-BENAR dinilai, supaya
       pendaftar yang satu komponennya belum diisi tidak terlihat jelek. Komponen `LULUS_TIDAK` tidak
       menambah skor tetapi **menggugurkan** bila ditandai tidak lulus (tes kesehatan / baca Qur'an).
     - **Gerbang hasil `spmb.hasilDibuka`**: selama "0", `/api/admissions/status` menyembunyikan keputusan
       dan hanya menyebut berkas sedang diperiksa. Panitia menekan "Buka Hasil" di /pusat-spmb/pengumuman.
       Penetapan status dari peringkat vs kuota ada di `/api/spmb/pengumuman` (GET = pratinjau, POST =
       terapkan); pendaftar yang **belum dinilai TIDAK ikut diputuskan** — statusnya dibiarkan apa adanya.
     - **`cocokJurusan` (src/lib/spmb-konten.ts) WAJIB dipakai setiap kali `Admission.chosenMajor`
       dibandingkan ke baris `Major`.** Formulir publik menyimpan LABEL `"Teknik Komputer dan Jaringan (TKJ)"`,
       bukan kode — pemeriksa kuota yang menyamakan `code`/`name` persis TIDAK PERNAH kena, sehingga kuota
       per jurusan diam-diam tidak pernah berlaku (bug nyata, ditemukan & diperbaiki 1 Okt 2026).
     - **Route admissions lama dijaga `verifySpmbAccess()`, bukan `verifyTasAccess()`** — portal dipakai guru
       berjabatan panitia, dan `verifyTasAccess` melempar mereka ke `/login` lalu proxy memantulkannya
       kembali ke dashboard, yang terbaca pengguna sebagai "tombolnya tidak berfungsi" (pelajaran #90).
     - `PendaftarManager` (dulu isi `/dashboard/admin/admissions/page.tsx`) kini komponen bersama dengan dua
       pembungkus tipis (DESIGN_SYSTEM §13).

103. **Formulir SPMB: satu pemeriksa untuk browser DAN server (`src/lib/spmb-form.ts`, 1 Oktober 2026).**
     Permintaan user: "perhatikan benar-benar saat klik daftar memang bisa digunakan, dan jika tidak bisa ada
     keterangan yang jelas apa yang kurang atau salah atau yang belum diisi".
     - Akar masalahnya DUA: (a) **tanggal lahir, jenis kelamin, jurusan, dan jalur dipegang komponen custom**
       (`DatePicker`, `Select`) yang **tidak ikut validasi bawaan browser**, jadi atribut `required` di situ
       tidak berlaku; (b) server hanya membalas `"Periksa kembali isian Anda."` tanpa menyebut isian mana.
       Gabungan keduanya membuat tombol Daftar terasa tidak berfungsi tanpa keterangan apa pun.
     - `periksaFormulirSpmb()` memeriksa **SELURUH** isian sekali jalan dan mengembalikan PETA kunci→pesan —
       bukan berhenti di kesalahan pertama, supaya pendaftar tidak menekan Daftar lima kali untuk menemukan
       lima kesalahan. Dipakai klien (sebelum kirim) DAN server (POST /api/admissions, membalas `kolom`),
       jadi pesannya identik. Jalur baru yang menyimpan `Admission` WAJIB lewat fungsi ini.
     - **`chosenMajor` dulu TIDAK WAJIB** — tersimpan `""` dan pendaftar itu tidak bisa diseleksi maupun
       dihitung kuotanya. Sekarang wajib.
     - **Isian berisi angka tetap `type="text"` + `inputMode="numeric"`, JANGAN `type="number"`**: NIK 16
       digit melewati batas aman bilangan JavaScript, angka 0 di depan NISN terbuang, dan `number` menerima
       "e"/"+" serta memunculkan tombol naik-turun yang tidak ada gunanya untuk nomor identitas.
     - Nomor WhatsApp diseragamkan ke bentuk `62…` saat disimpan (`rapikanNomorWa`) — tanpa itu satu orang
       bisa punya dua baris berbeda hanya karena menulis 0812 vs +62812.
     - Batas usia 11–25 tahun hanya **penjaga salah ketik tahun**, bukan aturan sekolah; ubah di
       `UMUR_MIN`/`UMUR_MAKS` kalau sekolah memang menerima di luar itu.
     - Dokumen syarat yang didaftarkan panitia (`DokumenSyaratSpmb`) muncul sebagai unggahan TAMBAHAN di luar
       lima slot baku, dan yang `wajib` **diperiksa ulang di server** — atribut `required` pada `<input>`
       hanya menghalangi di browser. Daftar syarat KOSONG tidak menutup pendaftaran (pelajaran PKL, #91).
     - `/api/admissions/upload` menyaring `type` (`[^a-zA-Z0-9_-]`) sebelum dipakai menyusun jalur folder —
       sebelumnya nilai dari browser langsung dipakai, bisa keluar dari `public/uploads/admissions` lewat `../`.

104. **Halaman SPMB publik punya tampilannya sendiri, dan ISINYA dari portal (1 Oktober 2026).**
     Permintaan user: "bisa set poster maupun foto promosi … di web ketika pilih spmb, tampilannya juga
     berbeda lebih keren", lalu "semua pengaturan spmb dan isi pengaturan halaman web spmb lengkap".
     - **Alur, syarat, beasiswa, dan tanya jawab DULU tertulis mati** di `src/app/admissions/page.tsx` —
       panitia tidak bisa mengubah satu kata pun tanpa deploy. Sekarang semuanya dari SiteSetting lewat
       `bacaKontenSpmb` (`src/lib/spmb-konten.ts`, NETRAL supaya penyunting klien & halaman server memakai
       bentuk data yang sama). Tiap isian baru WAJIB ada pembacanya di halaman (#39) — kunci yang hanya
       muncul di editor = isian mati.
     - **Tiga tema** (`spmb.tema`: malam / fajar / zamrud) memakai token warna yang sudah ada (§2), bukan
       warna baru. Poster potret, galeri foto promosi, brosur PDF, dan video YouTube (`idYoutube` menerima
       watch/youtu.be/shorts) diatur di /pusat-spmb/promosi.
     - **Alur & beasiswa boleh BERGAMBAR, opsional** (`Langkah.gambar`) — langkah tanpa gambar tetap rapi
       sejajar dengan yang bergambar; jangan dijadikan wajib.
     - Ditambah: `spmb.jadwal` (garis waktu, tanggal kosong ditulis "Menyusul"), `spmb.rincianBiaya` (tabel
       bertotal), `spmb.catatan` (pita pemberitahuan di atas halaman — mengubah padding pembuka jadi `pt-12`),
       `spmb.tautanGrup`, `spmb.jalur`, `spmb.bobotPrestasi`.
     - Label antarmuka tetap DUA BAHASA (#41); isi dari pengaturan hanya bahasa Indonesia.

105. **Cetak formulir SPMB yang sudah diisi — pendaftar & panitia (2 Oktober 2026).** Permintaan user:
     "formulir yang sudah diisi siswa juga bisa dicetak baik siswa maupun panitia/superadmin".
     SATU lembar bersama `FormulirSpmbSheet` dipakai dua pintu, jadi isinya tidak pernah berbeda:
     `/spmb/formulir?nomor=&t=` (pendaftar, tanpa akun) dan `/pusat-spmb/pendaftar/[id]/cetak` (panitia).
     - **Tanggal lahir TIDAK ikut di alamat halaman cetak.** `tandaFormulir()` (src/lib/spmb-formulir.ts)
       = HMAC-SHA256 dari `nomor|tanggal lahir` berkunci `SESSION_SECRET`, dipotong 32 karakter;
       diterbitkan `/api/admissions/status` HANYA pada jalur nomor + tanggal lahir (jalur WA/e-mail
       TIDAK diberi tanda — satu nomor WA bisa dipakai beberapa orang serumah). Kekuatan kuncinya
       sama, tetapi tanggal lahir anak tidak tertinggal di riwayat peramban komputer bersama.
       Pembandingnya `timingSafeEqual`, bukan `===`.
     - QR keaslian pola #49: `Admission.cetakToken` dibuat SEKALI lewat `updateMany where cetakToken: null`
       (dua cetakan bersamaan tidak saling menimpa) → `/verify/formulir-spmb/<token>`. Halaman verifikasi
       menampilkan IDENTITAS dokumen saja — nama DISAMARKAN, dan NIK/alamat/WhatsApp/e-mail TIDAK pernah
       ikut; keputusan seleksi juga tetap tertutup selama `spmb.hasilDibuka` masih "0". Terverifikasi di
       server: kelima data pribadi itu `False` di HTML halaman verifikasi.
     - `@page` ditaruh DI DALAM komponen lembar bersama (bukan di tiap halaman) justru karena dua pintu
       mencetak dokumen yang SAMA — kalau dipisah, marginnya bisa berbeda diam-diam.

106. **Tema halaman SPMB sampai ke Footer lewat VARIABEL CSS (2 Oktober 2026).** Temuan user: "tema banyak,
     tapi bagian footer halaman tersebut dan beberapa tombol dll belum sesuai tema".
     - Hero memang sudah bertoken, tetapi bagian TERANG di bawahnya (judul seksi, ikon, nomor alur, latar
       seksi), tab Cek Status, tombol kirim formulir, dan `Footer` memakai navy/emas tertulis mati — dan
       ketiganya komponen TERPISAH yang juga dipakai halaman lain, jadi mengoper prop berarti mengubah
       milik halaman lain.
     - Jalannya: `gayaTema()` (src/lib/spmb-konten.ts) memasang `--spmb-utama|aksen|aksen-teks|tipis|lembut|footer`
       di satu pembungkus `.tema-spmb`, lalu blok `.tema-spmb …` di akhir `globals.css` memetakannya ke
       utility yang dipakai DI DALAM pembungkus itu. **Blok itu SENGAJA DI LUAR `@layer`** — aturan tanpa
       layer menang atas utility Tailwind yang berada di dalam layer, tanpa `!important`. Terbukti di bundel
       produksi: `@layer properties|theme|base|components|utilities`, aturan `.tema-spmb` kedalaman kurung 0.
     - **Footer selalu bergradien GELAP, termasuk pada tema Terang** — teks footer putih; footer terang
       dengan teks putih tidak terbaca.
     - **Warna status (hijau diterima / kuning menunggu / merah belum diterima) TIDAK ikut tema.** Warna itu
       membawa arti; kalau berubah mengikuti tema, orang tua bisa salah membaca hasil seleksi.
     - Tujuh tema: malam, fajar, zamrud, senja, samudra, batik, **terang**. Tema terang baru mungkin setelah
       18 `text-white` tertulis mati di halaman diubah jadi token (`teks`/`lembut`/`samar`/`kacaIsi`) —
       sisa `text-white` sekarang NOL. Motif latar tidak di-invert pada tema terang (`polaInvert`).

107. **Dokumen SPMB hanya diatur di SATU tab (2 Oktober 2026).** Temuan user: "dokumen syarat dan isian
     formulir kok sama-sama ada dokumen?". Saat memindahkan tab "Form SPMB" dari Konten Halaman, kelima
     saklar dokumen ikut terbawa ke tab Isian Formulir padahal tab Dokumen Syarat sudah mengurus dokumen.
     - Sekarang `ISIAN_DATA_SPMB` (NIK, NISN, alamat, nama wali) vs `DOKUMEN_BAKU_SPMB` (ijazah, kk,
       ktp_wali, foto, dokumen_lain). Tab **Isian Data** hanya data; tab **Dokumen & Berkas** memuat
       SELURUH dokumen: "Dokumen baku" (punya kolom sendiri di `Admission`, tidak bisa dihapus — hanya
       wajib/opsional/sembunyikan) + "Dokumen tambahan" (`DokumenSyaratSpmb`, bebas).
     - Saklarnya satu komponen (`PilihanWajib`) dipakai kedua tab supaya tidak pelan-pelan berbeda.
     - Urutan tab mengikuti alur panitia: Gelombang → Komponen Nilai → Isian Data → Dokumen & Berkas →
       Isi Halaman Web.

108. **Poster jamak & animasi halaman SPMB (2 Oktober 2026).** Permintaan user: "poster itu beberapa poster,
     baik poster bisa bergerak … grid kartu gelombang atau yang lainnya bisa bergerak".
     - `spmb.posterLain` (JSON array) DI SAMPING `spmb.poster` — setelan poster yang sudah ada tidak hilang;
       `bacaKontenSpmb` menggabungkannya jadi `posters[]` (utama lebih dulu). `PosterSpmb` menampilkan satu
       poster diam, dua atau lebih berganti tiap 6 detik dengan titik penanda. Poster pertama SUDAH terlihat
       sejak muat (pergantian menimpanya), berhenti saat disorot & saat `document.hidden`, dan tidak diputar
       otomatis bila `prefers-reduced-motion: reduce`.
     - Kelas gerak (`spmb-muncul`, `spmb-kartu`, `spmb-denyut`, `spmb-kilau`) SELURUHNYA di dalam
       `@media (prefers-reduced-motion: no-preference)`. Itu bukan sekadar sopan santun: artinya tidak ada
       elemen yang dimulai dari `opacity: 0` bagi yang mematikan animasi, sehingga animasi yang gagal tidak
       pernah menyembunyikan isi halaman. Jeda berurutan lewat `style={{ animationDelay }}` per kartu.

109. **Kode referral SPMB (2 Oktober 2026) — `PerujukSpmb`, src/lib/spmb-perujuk.ts.** Permintaan user:
     "saat siswa daftar juga ada kode referral … siswa pakai NIS-nya, guru pakai nomor induk yayasan,
     dan bisa menambahkan orang luar".
     - **Registri SATU TABEL, bukan pencarian langsung ke `Student`/`Teacher`.** Kode siswa memang
       DIISI dari NIS dan kode pegawai dari NIP, tetapi yang diperiksa saat pendaftaran adalah baris
       `PerujukSpmb`. Tiga alasan: (a) kode harus tetap sah & bisa ditelusuri setelah siswa lulus atau
       guru keluar, (b) NIS & NIP hidup di tabel berbeda dan bisa bertabrakan — `kode @unique` di satu
       tabel membuat tabrakan MUSTAHIL secara struktur, (c) perujuk LUAR (alumni, wali murid, tokoh)
       tidak punya baris di tabel mana pun.
     - **DUA kolom di `Admission`, bukan satu**: `perujukKode` menyimpan kode PERSIS seperti diketik,
       `perujukId` hanya terisi bila kodenya ada & aktif. Jejak tetap terbaca walau baris perujuknya
       kelak dinonaktifkan; kode tak dikenali ditandai "(tidak dikenali)" di daftar pendaftar.
     - **Kode salah TIDAK PERNAH menggagalkan pendaftaran** (`cocokkanPerujuk` hanya mengosongkan
       `perujukId`) — salah ketik kode bukan alasan menolak anak orang. Karena itu `perujukKode` juga
       sengaja TIDAK masuk `periksaFormulirSpmb`.
     - **Nama perujuk DISAMARKAN di halaman publik + dibatasi 20 pencarian/IP/10 menit**, dan "kode
       tidak ada" dijawab SAMA dengan "kode nonaktif". Ini bukan kehati-hatian berlebihan: NIS sekolah
       ini berpola `001/001.064` dan NIP `TMP-004` — keduanya mudah ditebak — dengan 1.180 siswa, tanpa
       penyamaran endpoint ini menjadi pintu memanen seluruh nama siswa dari halaman yang terbuka umum.
     - **Bentuk kode massal bawaannya `NIS/NIP + 4 karakter acak`, BUKAN NIS polos.** NIS juga dipakai
       sebagai kartu absensi gerbang (#33) dan kartu perpustakaan (#34/#53) — menyebarkannya sebagai
       kode referral di media sosial berarti menyebarkan nomor kartu itu. Pilihan "apa adanya" tetap
       disediakan sesuai permintaan user, dengan peringatan tegas di layar saat dipilih. Penghasilnya
       aman ditekan berulang (yang sudah punya dilewati) dan memakai `randomInt`, bukan `Math.random`.
     - **Perujuk yang sudah membawa pendaftar tidak bisa DIHAPUS** (409) — hanya dinonaktifkan;
       menghapusnya memutus jejak asal pendaftar.
     - Yang dibagikan perujuk adalah TAUTAN/QR `…/admissions?ref=KODE`, bukan kodenya. Formulir
       menangkap `?ref=` → `sessionStorage` → terisi sendiri, jadi calon tidak mengetik apa pun.

110. **Kartu referral: tiga bentuk, tanpa halaman kartu baru (2 Oktober 2026).**
     - **Kartu pribadi tiap akun** ditempel DI BAWAH kartu identitas pada `/kartu-identitas`
       (`KartuReferral`) — BUKAN halaman kartu kedua, karena CLAUDE.md #53 melarangnya. Akun yang
       belum terdaftar sebagai perujuk TIDAK melihat apa pun (bukan kartu kosong / pesan "belum punya
       kode") — sebagian besar pengguna memang tidak perlu.
     - **Kartu A6 per perujuk**: `/pusat-spmb/qr?ref=KODE` — halaman kartu QR yang sama dipakai ulang,
       kakinya berubah menyebut nama perujuk.
     - **Cetak massal**: `/pusat-spmb/perujuk/cetak`, 8 kartu per A4 bergaris gunting, disaring per
       jenis. **Dibatasi 200 kartu sekali cetak** — tiap kartu memuat QR sebagai data URL, dan 1.180
       kartu sekaligus menjadi muatan puluhan megabita yang membuat peramban sekolah berhenti menanggapi.
     - **Beda alamat QR yang disengaja**: kartu Buku Tamu & kartu QR meja memakai HOST PERMINTAAN
       (kartu itu dipakai di dalam sekolah, bisa lewat `http://<ip>:3000`), sedangkan kartu referral
       memakai `ALAMAT_APLIKASI` — kartunya dicetak lalu beredar berbulan-bulan DI LUAR sekolah, jadi
       alamatnya harus yang permanen.

111. **Halaman SPMB: gerak, statistik, kuis, OCR (2 Oktober 2026).**
     - **Gerak situs publik tanpa pustaka** (blok "GERAK SITUS PUBLIK" di globals.css + `PengamatGerak` yang dipasang
       `Navbar`): `.gerak-naik/.gerak-judul/.gerak-ungkap/.gerak-batang/.gerak-alur`, judul dipecah `TeksGerak`.
       Keadaan tersembunyi HANYA di bawah `html.gerak-siap` (dipasang skrip) → bila skrip gagal isi tetap tampil.
       Pakai `animation` + fill **backwards**, BUKAN transition/forwards — keduanya menimpa transisi & `transform`
       hover kartu. Elemen ber-`clip-path` penuh (`.gerak-ungkap`) diamati lewat INDUKNYA: Chrome menghitung luas
       terlihatnya nol sehingga IntersectionObserver tidak pernah terpicu (foto berita sempat tertutup selamanya).
       Menguji tangkapan layar halaman berlapis banyak: gulir dengan `mouse.wheel` + tunggu; `scrollIntoView` lalu
       langsung memotret di headless menghasilkan kotak kosong palsu (gambar belum dirasterisasi).
     - **Satu sumber statistik `src/lib/spmb-statistik.ts`** (corong, sebaran wilayah, asal sekolah, peringkat
       perujuk) dipakai halaman publik & `/pusat-spmb/statistik`. Corong dari `SpmbJejak` (sesi acak per peramban +
       tahap, unik per pasangan, TANPA IP/isian) lewat `catatJejak` (src/lib/spmb-jejak.ts). Nama perujuk di halaman
       publik WAJIB `samarkanNama` (#109).
     - **Wilayah pendaftar = kode Kepmendagri 2025** di `public/data/wilayah` (sumber di SUMBER.txt). Server tidak
       percaya kode dari browser: `rapikanWilayah` mencocokkan ke berkas itu dan mengambil NAMA dari sana; kode
       salah = dikosongkan, bukan menolak pendaftaran.
     - **Kuis minat jurusan disusun dari data jurusan** (`susunKuis`, src/lib/kuis-jurusan.ts: keahlian/karier/
       fasilitas di Kelola Jurusan) — tidak ada daftar jurusan di kode (#11). Urutan pilihan memakai hash, bukan
       Math.random (#15). Hasil "Daftar" mengisi jurusan lewat peristiwa `spmb-pilih-jurusan` / `?jurusan=KODE`.
     - **OCR KK & ijazah jalan di BROWSER** (`tesseract.js`, dimuat dinamis; src/lib/ocr-berkas.ts) dan hanya
       MEMERIKSA ketikan (cocok / tidak + tombol "Pakai") — tidak pernah mengisi sendiri: KK memuat NIK seluruh
       keluarga, dan OCR bisa salah baca. Tanpa regex lookbehind (#66).
     - **Pratinjau tautan WA** = `src/app/admissions/opengraph-image.tsx`, WAJIB `force-dynamic` (#29). Gambar
       unggahan dibaca dari disk; ukuran asli dibaca dari kepala JPEG/PNG supaya poster tidak gepeng/terpotong.
     - **Kartu & galeri tidak boleh memotong poster/foto**: bentuk dipilih panitia (`RASIO_GAMBAR`, utuh/penuh),
       galeri tambahan di `spmb.galeriLain`. Formulir disembunyikan saat tidak ada gelombang buka; Cek Status tetap.

112. **Teknologi & efek situs publik gelombang 2 (2 Oktober 2026).**
     - **Speculation Rules + View Transitions lintas dokumen** dipasang `PramuatTransisi` (lewat Navbar → hanya
       halaman publik). Daftar jalur pra-muat DITULIS TEGAS — rute yang mengubah data saat dibuka (`/hadir`,
       `/aset`, keluar) jangan pernah dimasukkan. Halaman publik yang menulis ke DB saat dirender WAJIB melewati
       permintaan pra-muat (`headers().get("sec-purpose")` berisi prefetch/prerender) — contoh penghitung baca
       berita. Pencatat jejak SPMB menunda diri selama `document.prerendering`.
       Elemen "terbang" antarhalaman memakai `transisiJurusan`/`transisiBerita` (src/lib/nama-transisi.ts) dan
       HANYA bekerja untuk navigasi DOKUMEN — kartu yang ditautkan memakai `<a>`, bukan `<Link>` (navigasi klien
       tidak memicu transisi lintas dokumen). Nama harus unik per halaman.
     - Scroll-driven animation (`.bilah-baca`, `.gulir-zoom`) dibungkus `@supports (animation-timeline: scroll())`.
     - Bagikan = `TombolBagikan`: Web Share API, cadangan menu Popover API + CSS Anchor Positioning.
     - Sorot kursor (`.sorot-kursor`) dihitung SATU pendengar di `PengamatGerak`. `.tekstur-noise`/`.latar-aurora`
       untuk bagian gelap; isi di atasnya harus berposisi (relative) supaya berada di atas lapisan itu.
     - Bento Keunggulan beranda: foto `why.foto` (isian gambar baru di Konten Halaman, `type: "image"`); kosong =
       latar navy bertekstur. JANGAN memakai foto promosi SPMB sebagai cadangan — isinya poster bertulisan yang
       terpotong `object-cover` dan bertabrakan dengan judul (terlihat di uji 3 Okt 2026). Bento di HP = 1 kolom
       (2 kolom di 390px memotong kata panjang). Pita kata = `beranda.kataBerjalan`.
     - Story, deret logo, sebelum/sesudah mengambil bahan dari Pusat SPMB → Poster & Promosi (`spmb.galeriLain`,
       `spmb.logoMitra`, `spmb.sebelumSesudah`) — beranda membaca kunci yang sama. Galeri Foto situs (model
       `Gallery`) dan data mitra industri MASIH KOSONG per 2 Okt 2026; jangan mengisi contoh karangan.
     - Ikon merek (Facebook dsb.) TIDAK ADA di lucide-react 1.x — jangan diimpor.

113. **Papan TV: mode pengumuman, Mode Bel per TV, dan Bel Ujian (4 Oktober 2026).**
     - **Bug "pilih teks saja malah teks + suara"**: `PapanLayar` dulu memulai state `kabar.cara` dari
       `"TEKS_SUARA"` tertulis mati, dan mode yang benar baru terbaca dari `/kabar` 10 detik kemudian — padahal
       dashboard MEMBUKA ULANG papan tepat setelah mengirim pengumuman, jadi bug itu terjadi setiap kali. Sekarang
       `manualCara` ikut muatan halaman. Penanda "sudah dibacakan" disimpan di localStorage TV
       (`papan-dibacakan:<token>`) supaya muat ulang tiap 10 menit tidak membacakan ulang; dihapus saat pengumuman
       dicabut. **Setiap nilai yang menentukan perilaku SAAT DIMUAT wajib ikut muatan awal, bukan menunggu denyut.**
     - **Profil bel** (`BellSchedule.profil` REGULER | UJIAN, src/lib/bel-profil.ts): bel UJIAN menggantikan bel
       REGULER pada tanggal Kegiatan Ujian AKTIF — di speaker pusat (`/bel-sekolah/player`, lewat kolom `berlaku`
       yang dihitung SERVER di GET bell-schedule) MAUPUN di semua TV. Tanpa bel UJIAN yang disusun, hari ujian tetap
       memakai bel REGULER (tidak pernah jadi hari tanpa bel). Bel ujian tetap mengikuti hari yang dicentang.
     - **Mode Bel per TV** (`Layar.belMode` NORMAL | HENING | UJIAN + `belModeSampai`, lewat `modeBelBerlaku`) untuk
       ruang ANBK/TKA. HENING: bel & volume tidak disentuh, pengumuman TETAP TAMPIL sebagai teks tanpa nada/suara —
       termasuk mode "suara saja" (kalau tidak, pesan seperti token hilang di ruang ujian). Status hening ikut
       `/kabar` (10 dtk); jadwal bel UJIAN per TV terpakai saat papan dimuat ulang. Mode Hening SENGAJA hanya untuk
       TV yang dipilih — speaker pusat tetap berbunyi (keputusan user).

114. **Daya TV & izin ADB (4 Oktober 2026).**
     - **"Matikan" = KEYCODE_SLEEP (223), bukan tombol daya (26).** Tombol daya mengikuti mode daya yang disetel di
       TV — Doze mematikan WiFi sehingga TV tidak bisa dinyalakan lagi dari jauh. Tidur hanya memadamkan layar;
       sistem tetap hidup apa pun modenya (diuji di TV Lab DKV: Asleep tetap menjawab ADB, KEYCODE_WAKEUP
       menyalakan). Tombol daya sungguhan tetap ada sebagai `dayaTotal`. Jadwal mati otomatis ikut memakai tidur.
     - **Mode daya TCL TIDAK bisa diubah lewat ADB.** Satu-satunya setelan yang berbeda antar-mode adalah
       `system tcl_sys_network_standby_enabled` (1 = Siaga jaringan); Tanpa layar vs Doze dipegang layanan daya
       TCL sendiri. Jangan menulis setelan TCL setengah jalan.
     - **Android 11+ membatalkan izin debugging setelah 7 hari tanpa sambungan ADB.** `terapkanPenjaga`
       (src/lib/layar-adb.ts) menyetel `adb_allowed_connection_time 0` + `screen_off_timeout` maksimum +
       `sleep_timeout -1` tiap kali tersambung (≤ sekali per 6 jam per TV — TV bisa mengembalikan setelannya).
       TV yang sedang mati baru mendapatkannya saat menyala berikutnya.
     - **Status "hidup" dari router ≠ layar menyala.** `statusLayar` membaca `mWakefulness` (disinggahkan 60 dtk)
       dan daftar TV menampilkan "Siaga · layar mati".
     - **IP basi**: DHCP bisa memberikan alamat TV yang sedang mati ke TV lain. `daftarLayar` memakai tabel ARP +
       host hotspot sebagai pemilik alamat dan MEMBUANG alamat milik MAC lain dari calon, sekaligus menghapus
       `ipTerakhir` yang sudah dipakai perangkat lain — rute ADB memakai `ipTetap || ipTerakhir` langsung, jadi
       alamat basi berarti perintah dikirim ke TV yang salah (kasus TV Ruang B3 ↔ Lab DKV).

115. **Foto Kartu (KTS) terpisah + hairpin router (4 Oktober 2026).**
     - Kartu Tanda memakai urutan SATU sumber `fotoUntukKartu` (src/lib/foto-kartu.ts): `bukuIndukData.fotoKartuUrl`
       → Foto Masuk → foto profil akun (keputusan user: foto resmi didahulukan). Foto Kartu diisi per orang di Buku
       Induk (siswa & guru, folder `buku-induk/kartu`) atau MASSAL di Kartu Tanda → "Unggah Foto Kartu"
       (`/api/admin/kartu-tanda/foto-massal`): langkah `cocok` hanya menerima NAMA berkas (NIS/NISN siswa, NIP guru,
       tanda baca dibuang — NIS `001/001.064` boleh `001-001.064.jpg`), langkah `simpan` setelah pratinjau. Nomor
       yang dimiliki >1 orang (GANDA) dan dua berkas untuk satu orang (DOBEL) DILEWATI, tidak pernah ditebak.
     - `/api/upload` dulu menolak staf TU (peran TAS) & guru berjabatan TU untuk folder `buku-induk/*`, padahal
       halaman Buku Induk/Kartu Tanda terbuka bagi mereka — sekarang diizinkan dengan pemeriksaan jabatan yang
       sama dengan `verifyTasAccess`.
     - **Router: aturan srcnat `*38A`** ("Hairpin NAT - situs sekolah via domain (80/443) dari subnet server sendiri",
       `src=172.15.0.0/28 dst=172.15.0.3 tcp 80,443 masquerade`). Tanpa itu SERVER SENDIRI (dan Proxmox/PC Dapodik
       di 172.15.0.x) tidak bisa membuka domain sekolah — jawaban server tidak kembali lewat router. WiFi guru/siswa
       berbeda subnet dan sudah tertangani aturan dst-nat `dstType=local` port 80/443 yang ada sebelumnya.

116. **Lomba & Event (4 Oktober 2026) — `Event` + `PendaftaranEvent`, src/lib/event-{label,guard,server}.ts.**
     Pengelola: `/dashboard/{admin,teacher}/event` (`EventManager`); publik: `/lomba` & `/lomba/<slug>`;
     siswa: `/dashboard/student/lomba` (status & catatan panitia). Daftar jabatan pengelola SATU sumber
     `JABATAN_EVENT` di `event-label.ts` (netral) — dipakai penjaga server DAN TeacherSidebar.
     - **Siapa boleh mendaftar diputuskan SERVER** (`POST /api/event/[slug]/daftar`): siswa yang masuk =
       dirinya sendiri (`studentId` dari sesi, unik per event, disaring `jurusanIds`); event **milik sekolah**
       juga menerima peserta luar tanpa akun (5 kiriman/IP/10 mnt); lomba **pihak luar** HANYA siswa; bila
       `tautanLuar` diisi, pendaftaran di situs penyelenggara. Halaman detail hanya memilih tampilan.
     - Batas daftar = akhir hari `tutupDaftar` **WIB** (`batasDaftar`). Tanggal event disimpan tengah malam
       UTC tanggal itu dan ditampilkan dengan `timeZone: "UTC"` (`tglEvent`).
     - **Karya & bukti bayar = folder RAHASIA** `public/uploads/rahasia/event`, dibuka lewat
       `/api/event/berkas/[pid]/karya|bukti` (pengelola atau siswa pemilik). Menghapus event/pendaftar ikut
       menghapus berkasnya. Poster & panduan PDF memang publik → folder `event` di `/api/upload`.
     - **Batas unggah 6 MB (karya) + 3 MB (bukti)** karena proxy Next memotong badan permintaan di atas
       10 MB (`proxyClientMaxBodySize` bawaan). Karya lebih besar lewat `karyaTautan` (Drive/YouTube) —
       jangan menaikkan batas berkas tanpa menaikkan setelan proxy itu.
     - Tidak ada notifikasi otomatis (belum diminta). Status `JUARA` wajib berisi `juara` ("Juara 1").

117. **Kunci komputer lab: Safe Exam Browser + MyAlwis Ujian Windows (4 Oktober 2026).** Referensi user: Exambrowser
     Client & Proktor Browser ANBK/TKA (Pusmenjar). Program itu TIDAK dipakai/diubah — kodenya disamarkan, setelannya
     terenkripsi, dan terikat server Pusmenjar; yang diterapkan cara kerjanya.
     - **Bug lama SEB: `req.url` di Next standalone = `http://<hostname>:3000/…`**, padahal SEB meng-hash
       `https://smkalmunawwiriibs.sch.id/…` — kunci yang benar pun selalu ditolak. URL kini disusun ulang dari
       X-Forwarded-Proto + Host (`urlDilihatSeb`). Isian kunci SEB juga tidak pernah ada di layar dan PUT tidak
       menyimpannya; GET mengirim kunci ke semua guru — ketiganya diperbaiki.
     - **Berkas `.seb` dibangkitkan situs** (`src/lib/seb-konfig.ts`, unduh dari Pengaturan Ujian, sandi keluar = PIN
       keluar `ujian.pinAplikasi`). Config Key dihitung server dari berkas yang sama, TETAPI baru dipakai mengunci
       setelah terbukti cocok sekali di komputer lab lewat `/seb-uji` (`ujian.sebCkTerverifikasi`). Algoritmanya
       belum bisa diuji dari server; kalau meleset, ujian tidak terkunci mati. Ubah isi `pengaturanSeb` = Config
       Key berubah = semua komputer lab wajib menyalin berkas baru & uji ulang.
     - **MyAlwis Ujian Windows** (`windows-ujian/`, Electron 33, portabel zip, dibangun `bangun-exe.sh` tanpa wine —
       ikon dipasang `resedit`). Zip ±115 MB disimpan di VOLUME unggahan (`public/uploads/unduh`), BUKAN image, dan
       diunduh lewat `/api/unduh/windows-ujian` (dialirkan; `/api/uploads` membaca utuh ke memori). Jembatan
       `window.AplikasiSMK` SAMA dengan Android → halaman ujian tidak perlu diubah. User-Agent `MyAlwisUjianWin/1.0`
       ikut `lewatAplikasi`. Sesi hanya di memori (komputer bergantian). Batas jujur: Ctrl+Alt+Del & tombol Windows
       tidak bisa dicegat — untuk itu SEB.

118. **TV setelah listrik padam = SIAGA DINGIN (5 Oktober 2026).** Laporan user: setelah mati lampu, TV Lab TKJ/AKL/DKV
     tidak bisa dinyalakan dari papan. Setelan pabrik TCL `ro.odm.tcl.poweron_shop_status = standby`: begitu listrik
     kembali TV siaga dingin — Android belum jalan, WiFi mati, router & ADB tidak melihatnya sampai remote ditekan
     sekali. Setelan penjaga (#114: izin ADB tanpa batas, layar tak padam) TERBUKTI bertahan setelah padam.
     - Penawar permanen = menu **Hotel** TV → **Mode Nyala** (`EnHotelMenu.PowerOnMode`, lewat middleware TCL —
       BUKAN kunci `settings`, jadi tidak bisa diubah ADB; `am start com.tcl.hotelmenu/.MainActivity` diam-diam
       ditolak TV). Harus lewat remote dengan kode menu hotel model itu — jangan menebak kodenya. Kunci
       `tcl_app_factory_poweron_shop_status` = mode TOKO, jangan disentuh.
     - Pilihan yang disarankan "Langsung menyala", karena `matikanLayarTerjadwal` hanya menembak SEKALI di menit
       jadwalnya. Penutup celahnya `tidurkanSetelahPadam` (layar-jadwal.ts, tiap 5 mnt): di LUAR [jadwalNyala,
       jadwalMati) atau hari libur, TV yang baru boot (< 40 mnt, `keadaanBoot`), layar menyala, dan yang tampil
       beranda/papan → ditidurkan SEKALI per boot. Hanya TV yang punya KEDUA jadwal. `bukaPapanOtomatis` kini
       melewati TV yang layarnya padam supaya tidak membangunkan yang baru ditidurkan.
     - Pesan "TV tidak terjangkau" (`PESAN_STATUS.TIDAK_TERJANGKAU`) & pemberitahuan di Papan & TV menyebut siaga
       dingin lebih dulu — itu penyebab tersering, bukan papan rusak.

119. **Analisis butir soal = satu sumber `hitungAnalisisButir` (src/lib/analisis-butir.ts, 5 Oktober 2026).**
     Dipindah dari rute `/api/teacher/exams/[id]/hasil` supaya tab Hasil, Excel, dan **Rekap Analisis Butir per
     kegiatan** (`/pusat-ujian/analisis-butir`, `rekapAnalisisKegiatan` di analisis-butir-server.ts, cakupan =
     `filterDaftarUjian`) selalu sama angkanya. Ditambah **reliabilitas** (Cronbach alpha / KR-20, ≥10 peserta & ≥3
     butir, hanya bila semua peserta menerima butir yang sama) beserta ALASAN bila tak terhitung.
     - **Butir yang BELUM DIKOREKSI tidak ikut dihitung** (`dinilai`: `skorButir[q] ` harus angka). Dulu nilai null
       dihitung 0 — ujian uraian yang belum dikoreksi mendapat "terlalu sukar, perlu revisi" palsu (uji data nyata:
       6 butir palsu pada ujian KK1 37 peserta → 0 setelah diperbaiki).
     - Bank Soal belum bisa menampilkan statistik butir: soal ujian = SALINAN tanpa tautan ke `QuestionBankItem`.

120. **Layar Proktor (5 Oktober 2026) — `src/lib/proktor-layar.ts`.** Padanan Proktor Browser ANBK: MyAlwis Ujian Windows
     v1.1 memotret JENDELA UJIANNYA SENDIRI (`webContents.capturePage`, 640px JPEG) tiap 10 detik + seketika saat jendela
     kehilangan fokus, selama mode ujian → `POST /api/student/exams/[id]/cuplikan` (hanya UA `MyAlwisUjianWin`, pengerjaan
     milik sendiri & belum dikumpulkan, ≥4 dtk antar-kiriman, ≤250 KB, harus JPEG). Pengawas: panel **Layar Peserta**
     (`LayarProktorPanel`) di tab Pantau → `/api/teacher/exams/[id]/proktor[/studentId]` (`ujianDalamCakupan`); yang tidak
     fokus diberi tanda merah & didahulukan. **HANYA DI MEMORI** (satu potret terakhir per peserta, kedaluwarsa 2 menit) —
     jangan ditulis ke disk/DB. Yang dipotret jendela ujian, bukan desktop (desktop justru hitam karena setContentProtection).
     Peserta melihat tanda "● Layar dipantau pengawas" (preload.js) — jangan dihapus. Belum diuji di Windows sungguhan.

121. **Login passkey (5 Oktober 2026) — `Passkey` + `src/lib/passkey.ts`, `@simplewebauthn/{server,browser}` v13.**
     Daftar di Profil (`KelolaPasskey`: admin, guru, orang tua, bendahara — `PERAN_PASSKEY` tanpa STUDENT karena akun siswa
     dipakai di komputer lab bersama), masuk lewat tombol di /login (`MasukPasskey`, discoverable credential — tanpa
     mengetik email). Masuk memakai `masukkanSesi` + `resolveRedirectTarget`/`ambilLanjut` yang SAMA dengan login sandi
     (dipindah ke `src/lib/tujuan-masuk.ts` karena ekspor dari berkas "use server" = server action yang bisa dipanggil luar).
     - rpID/origin dari X-Forwarded-Proto + Host (bukan `req.url`, pelajaran #117); HANYA HTTPS — di `http://<ip>:3000`
       tombol tidak muncul dan rute menolak. Passkey terikat domain pembuatnya (`Passkey.rpId`).
     - `userVerification: "required"` → admin ber-2FA TIDAK diminta kode TOTP lagi (passkey = perangkat + biometrik/PIN).
     - Tantangan sekali pakai di memori (kunci acak di cookie HttpOnly `passkey_tantangan`, path /api/passkey, 5 menit).
       Masuk dibatasi 30 percobaan/IP/5 mnt. Ganti sandi TIDAK menghapus passkey; menghapus dilakukan pemilik di Profil.
     - **Tombol di /login HANYA tampil di perangkat yang pernah mendaftar** (penanda localStorage `myalwis-passkey-hp`,
       src/lib/passkey-klien.ts) dan langsung MEMINTA SIDIK JARI OTOMATIS saat halaman terbuka — kecuali tepat setelah
       Keluar (`?keluar=1` / sessionStorage `barusKeluar`). Temuan user 5 Okt 2026: di HP yang belum mendaftar, tombol
       yang selalu tampil hanya memunculkan lembar Android "Login dengan cara lain". Peramban sengaja tidak memberi tahu
       situs apakah ada passkey, jadi situs mengingatnya sendiri; 401 dari server menghapus penanda.
     - **Pendaftaran DITAWARKAN setelah login sandi** (`TawaranPasskey`, root layout, hanya /dashboard, sekali per sesi,
       "Nanti" = 14 hari). Satu jalur pendaftaran untuk tawaran & Profil: `daftarkanPasskey` (passkey-klien.ts).

122. **MyAlwis Mobile v2.4 = passkey di dalam aplikasi + pita pembaruan (5 Oktober 2026).** Permintaan user: passkey juga
     di aplikasi, "tapi tinggal update aplikasi".
     - Pustaka PERTAMA aplikasi: `androidx.webkit:webkit` (`android.useAndroidX=true`) hanya untuk
       `WebSettingsCompat.setWebAuthenticationSupport(..., WEB_AUTHENTICATION_SUPPORT_FOR_APP)` bila
       `WebViewFeature.WEB_AUTHENTICATION` didukung (WebView lama dilewati, login sandi tetap). APK naik ±140 KB → ±1 MB.
     - Mode FOR_APP: Android memeriksa `public/.well-known/assetlinks.json` (paket `sch.almunawwir.ujian` + SHA-256
       sertifikat rilis, relasi `get_login_creds`), dan WebAuthn mengirim origin `android:apk-key-hash:<b64url sha256>`
       (`ORIGIN_APLIKASI`, src/lib/passkey.ts) yang diterima di samping origin situs. **Ganti kunci rilis = ganti
       keduanya.** Belum diuji di HP sungguhan dari server ini.
     - Pemasangan menimpa: sertifikat sama (diperiksa `apksigner`) & versionCode 5 → 6, jadi data & login tidak hilang.
     - **`PitaPerbaruiAplikasi`** (root layout): hanya di aplikasi Android yang versinya < `VERSI_APLIKASI` (dibaca dari
       UA `MyAlwisMobile/x.y`; penanda lama = pasti tua), tombol Perbarui mengunduh `BERKAS_APK`, bisa ditunda sehari,
       tidak tampil di halaman pengerjaan ujian/layar dinding. Rilis berikutnya cukup menaikkan `VERSI_APLIKASI`
       setelah APK baru terpasang di `public/unduh` — pita muncul sendiri di semua HP versi lama.
     - **v2.5 — KUNCI SIDIK JARI saat aplikasi dibuka** (user: "seperti aplikasi bank", pilihan "Keduanya" = kunci +
       passkey saat sesi habis). `BiometricPrompt` bawaan Android (BIOMETRIC_WEAK | DEVICE_CREDENTIAL; API 24–27 lewat
       `KeyguardManager.createConfirmDeviceCredentialIntent`) — tanpa pustaka. Tirai navy menutupi WebView sampai lolos.
       Syarat: sudah masuk (cookie `sesi_segar` via CookieManager), HP punya kunci layar, setelan menyala (bawaan NYALA,
       disimpan di SharedPreferences HP), BUKAN mode ujian, dan cold start atau kembali dari latar > 2 menit.
       **Waktu ke latar dicatat di `onStop`, bukan `onPause`** — dialog sidik jari memicu onPause/onResume → putaran
       tanpa henti. Jalan keluar "Masuk dengan akun lain" menghapus cookie lalu ke /login?keluar=1. Sakelar ada di
       Profil (`KunciAplikasi`, lewat jembatan `AplikasiSMK.kunciSidikJari/aturKunciSidikJari/bisaKunci` — hanya
       tampil di aplikasi v2.5+, termasuk siswa).

123. **Tanda tangan digital guru & staf (5 Oktober 2026) — `User.ttdBerkas`, src/lib/ttd.ts.** Permintaan user: TTD bisa
     diunggah mandiri (Profil → "Tanda Tangan Saya": gambar di layar ATAU foto) atau oleh Admin/TU
     (/dashboard/admin/tanda-tangan, `petugasTu`), lalu dipakai di dokumen cetak: "di notulen rapat ketika guru hadir bukan
     lagi centang tapi TTD, begitupun berita acara ujian dan berkas lainnya".
     - **Tiga hal berbeda, jangan disatukan:** (1) QR keaslian (#49) = bukti dokumen berasal dari sistem, bukan tanda
       tangan; (2) `letterhead.ttdKepalaSekolah` = TTD JABATAN (biasanya + stempel) untuk dokumen atas nama sekolah — surat
       keluar, surat keterangan, kartu tanda, rapor yang disahkan; (3) TTD PRIBADI tiap akun = kehadiran/peran orangnya
       sendiri. Kepala Sekolah yang hadir rapat diparaf dengan TTD pribadinya; TTD jabatan TIDAK pernah disisipkan
       otomatis ke dokumen selain yang sudah memakainya.
     - Berkas di folder RAHASIA `public/uploads/rahasia/ttd` (diblokir proxy). Dokumen cetak menyisipkannya sebagai
       DATA URL dari server lewat `petaTtd(userIds)` — jangan menautkan `/api/ttd/[userId]` dari dokumen (rute itu hanya
       pemilik & TU, untuk pratinjau). Gambar diolah sekali saat unggah (`olahGambarTtd`: latar terang → transparan,
       pangkas, ≤900×300).
     - **TTD hanya disisipkan bila orangnya PASTI, tidak pernah menebak:** peserta rapat dicocokkan ke akun saat notulen
       disimpan (`MeetingAttendee.userId`, cadangan `cocokkanNamaPegawai` saat cetak — nama yang dimiliki >1 pegawai tidak
       dicocokkan; tamu luar tetap ✓). Pengawas ujian lewat `pengawasKelasUjian` (KELAS = `susunPengawasKelas`; RUANG = siswa
       kelas itu di SATU ruang+sesi dan ruang itu SATU pengawas pada tanggalnya) — selain itu nama & TTD dibiarkan kosong
       untuk ditulis tangan. Wali kelas di rapor & leger HANYA setelah nilai DIKUNCI (padanan TTD kepala setelah disahkan).
     - Sudah dipasang: notulen rapat (daftar hadir "Paraf" + notulis), Berita Acara & Daftar Hadir ujian (pengawas),
       Kisi-kisi (guru), rapor format sekolah & leger (wali kelas), Kalender Absensi & Absensi/Jurnal Kelas (wali kelas),
       Jurnal Mengajar (guru, `/api/teacher/me?ttd=1`). Dokumen cetak baru yang memuat nama guru/staf di blok tanda tangan
       memakai `petaTtd` + `<GambarTtd>` (ruang kosong setinggi sama bila belum ada TTD, tata letak tidak bergeser).
     - **Kepala Sekolah di dokumen TU = TTD PRIBADI** lewat `ttdDariNama(principalName)` (permintaan user 5 Okt 2026: "atau
       berkas lain yang membutuhkan TTD"): notulen, buku tamu, ekspedisi, legalisir, serah terima ijazah, disposisi (nama
       pemberi disposisi bila diisi), surat tugas (penanda tangan), kalender pendidikan & matriks, rekap presensi pegawai,
       profil sekolah, rekap surat tugas, rekap calon & rekap peserta didik nominatif, berita acara verval, rekap ruang ujian,
       berita acara ujian, kisi-kisi, kartu soal (+ penyusun). Halaman KLIEN (Buku Induk Siswa, Buku Mutasi) memakai
       `/api/ttd/kepala` (khusus Admin/TU) — JANGAN menaruh TTD di `/api/settings/school-info` yang terbuka umum.
       Pengecualian yang disengaja: surat keluar/surat keterangan/kartu tanda/rapor tetap TTD JABATAN berstempel; Leger
       memakai TTD jabatan setelah disahkan (sama dengan rapor); Form Katrol ber-TTD guru hanya setelah DIKIRIM; Tata Tertib
       TIDAK ber-TTD (dibuka semua siswa — TTD mudah disalin); pejabat luar (Pengawas, Kacabdin) & "Operator Sekolah" tanpa
       nama tidak punya akun pasti, jadi tetap kosong.
     - **Notulen LAMA ikut ber-TTD saat dicetak ulang** (keputusan user 5 Okt 2026: "Semua notulen", untuk melengkapi arsip) —
       jangan dibatasi ke notulen sejak fitur ini ada. Notulen sebelum 5 Okt 2026 dicocokkan lewat nama saat cetak.

124. **Mode pemeliharaan (5 Oktober 2026) — `src/lib/pemeliharaan.ts`, halaman `/dashboard/admin/pemeliharaan` (khusus ADMIN).**
     Permintaan user: "halaman maintenance, bisa dimatikan hidupkan, kecuali saat login dengan superadmin tidak ada dampak".
     - Diperiksa di `proxy.ts` untuk SETIAP permintaan; status (SiteSetting `sistem.pemeliharaan*`) disinggahkan 10 detik di
       memori dan dibuang saat disimpan. Gagal membaca DB = dianggap TIDAK pemeliharaan (jangan menutup sekolah karena DB tersendat).
     - Bebas dampak: peran ADMIN dan admin yang sedang "Masuk Sebagai" (`session.imp.role === "ADMIN"`). Jalur yang tetap terbuka
       (`jalurBebas`): `/login` (+2FA, satu jalur), `/api/passkey`, `/pemeliharaan`, berkas statis & `/uploads` (non-rahasia), dan papan
       TV `/layar` + `/api/layar` — bel sekolah di TV tidak boleh ikut mati. Menambah jalur bebas baru = pikirkan dulu apakah jalur itu
       bisa mengubah data.
     - Halaman → DIALIHKAN (307) ke `/pemeliharaan?dari=<asal>`, BUKAN ditulis-ulang: dengan alamat asli, komponen layout akar (tombol
       WhatsApp dsb.) mengira halamannya beranda. `dari` hanya diterima bila diawali satu "/" tanpa "/" atau "\" berikutnya
       (`/\x.com` dibaca peramban sebagai `//x.com`). API → 503 JSON + `Retry-After`.
     - Halaman pengaturan memperingatkan bila ada siswa SEDANG ujian (`pesertaSedangUjian`) — menyalakan pemeliharaan memutus ujian mereka.

125. **Jawaban ujian SUSULAN — antrean luring yang terkirim setelah waktu habis (6 Oktober 2026).** Layar ujian sudah offline-first
     (jawaban masuk antrean localStorage lalu dikirim), tetapi dua celah membuat jawaban siswa yang terputus di menit-menit akhir HILANG:
     (a) `/jawab` menolak semua jawaban yang TIBA setelah tenggat + `TOLERANSI_MS`, tanpa melihat kapan DIBUAT; (b) jawaban yang ditolak
     403 `habis` tidak pernah keluar dari antrean, sehingga pengumpulan menunggu "koneksi" SELAMANYA walau sudah tersambung.
     - Klien mengirim `dibuat` = waktu jawaban dibuat dalam JAM SERVER (`it.t + selisihRef`). Server menerima jawaban lewat tenggat bila
       `dibuat` ≤ tenggat + toleransi, ≥ mulai, dan tiba ≤ tenggat + `BATAS_SUSULAN_MS` (60 mnt, src/lib/ujian-server.ts); tiap jawaban
       susulan dicatat di jejak `JAWABAN_SUSULAN` ("dibuat … tiba …") supaya terlihat pengawas. Jam `dibuat` berasal dari perangkat —
       batas 60 menit + jejak itulah pengamannya; jangan dilonggarkan tanpa alasan.
     - 403 `habis` = ditolak permanen: item DIBUANG dari antrean lalu ujian dikumpulkan (`habisRef`), bukan dibiarkan menggantung.

126. **Template & impor Excel Buku Induk = sama dengan formulir, dan impor ulang TIDAK menghapus data (6 Oktober 2026).**
     Pertanyaan user: "form template excel buku induk guru dan siswa apakah sudah sesuai dengan form". Temuannya:
     - **Guru: template hanya 14 dari 111 kolom.** Sekarang kolom di luar 14 kolom dasar DITURUNKAN dari formulir lewat
       `GURU_KOLOM_IMPOR` (src/lib/buku-induk-guru-columns.ts = `GURU_EKSTRA_BUKU` + `GURU_COLUMNS` bertanda `isian`) — dipakai
       template DAN impor, dan `GURU_EKSTRA_BUKU` juga dipakai biodata pegawai (#93). Isian baru di formulir guru otomatis ikut.
     - **Siswa: 13 kolom template tidak pernah dibaca impor** (NIS asal, nomor surat masuk/keluar, kelas asal, 7 kolom alamat
       wali, lintang/bujur PKL) — isian petugas terbuang diam-diam. Template siswa masih DITULIS TANGAN; menambah isian formulir
       siswa = tambahkan juga ke template DAN impor (judul harus PERSIS sama — impor membaca `row["<judul>"]`).
     - **Impor ulang DIGABUNG, bukan ditimpa** (siswa & guru): dulu `bukuIndukData` diganti utuh sehingga isian yang tidak ada /
       kosong di Excel terhapus (termasuk Foto Kartu), dan Status kosong mengembalikan siswa LULUS/PINDAH & guru PENSIUN/KELUAR
       menjadi AKTIF. Sekarang hanya sel TERISI yang menimpa; Status kosong = status lama. Bawaan "AKTIF" hanya untuk data baru.
     - Password awal akun guru dari impor = `Almunawwir1` (dulu NIP — mudah ditebak & tidak seragam dengan siswa/formulir).

127. **Alokasi Dana iuran (6 Oktober 2026) — `AlokasiRencana`/`AlokasiAngkatan`/`AlokasiTransaksi`, src/lib/alokasi-dana.ts.**
     Permintaan user: iuran per angkatan (mis. X 120 siswa × Rp200.000/bulan) dibagi ke pos anggaran (Kesiswaan sekian %, Kegiatan
     Umum sekian %, …) dengan rincian lengkap. Keputusan user: menu baru di grup **Keuangan** (bukan di portal Bendahara lama, yang
     tetap tidak disentuh), cakupan **rencana + realisasi**, pos **boleh beda per angkatan**, dan **"hanya untuk perhitungan"** —
     TANPA tahap pengesahan/penguncian & tanpa blok tanda tangan di cetakan. Halaman `/dashboard/{admin,teacher}/alokasi-dana`
     (`AlokasiDanaManager`), cetak `…/alokasi-dana/cetak?id=`, Excel `/api/alokasi-dana/[id]/ekspor`. Akses = Admin + jabatan
     Bendahara Sekolah/BOS/BPOPP lewat `assertBendahara` (dipakai ulang dari bendahara-guard; modulnya sendiri tidak diubah).
     - **Satu sumber hitung** (`hitungRencana`, `hitungRealisasi`) dipakai layar, cetak, DAN Excel — jangan menghitung ulang di tempat lain.
     - Aturan hitung: pemasukan = (siswa − keringanan) × iuran + Σ keringanan × iuran khususnya; pos NOMINAL (Rp/siswa/bulan, untuk
       SEMUA siswa) diambil dulu, sisanya dibagi pos PERSEN; tiap pos dibulatkan ke bawah lalu SISA PEMBULATAN masuk pos penampung
       (`posPenampung`, kosong = pos persen pertama) sehingga Σ pos = pemasukan PERSIS. Total persen ≠ 100 TIDAK disebar diam-diam —
       tampil "Belum dialokasikan" + peringatan.
     - Rekap per pos menjumlahkan pos BERNAMA SAMA lintas angkatan (huruf besar/kecil & spasi diabaikan) — nama pos adalah kuncinya.
     - Realisasi: uang MASUK satu angkatan dibagi ke pos angkatan itu SESUAI PORSI RENCANANYA (pos nominal ikut), porsi belum
       dialokasikan tetap di "Belum dialokasikan"; KELUAR mengurangi satu pos → saldo per pos. Menghapus angkatan TIDAK menghapus
       transaksinya (`onDelete: SetNull`, uangnya pindah ke "Belum dialokasikan").

128. **Motif SMK miring −45° di SEMUA tempat (6 Oktober 2026) — `public/images/pattern-smk-miring.png`.** Keputusan user: "pattern
     fix pakai −45", jarak motif tetap. Ubin 849×849 dihitung per piksel dari motif lurus (bukan diputar sebagai gambar biasa) supaya
     menyambung mulus; DIPERIKSA sejajar dengan putaran CSS sungguhan & tanpa garis sambungan di perbesaran 2×. Kisi miring berulang
     tiap jarak × √2, jadi **`background-size` baru = ukuran lama × 1,4142** (DESIGN_SYSTEM §2) — 78 pemakaian + watermark ONLYOFFICE
     (`PATTERN_TILE_PX` 90 → 127) diganti sekaligus. Pemakaian pola baru WAJIB memakai berkas miring dengan ukuran yang sudah dikali √2.
     `BendaharaSidebar` sengaja tetap lurus (modul Bendahara tidak disentuh). Gambar baru bernama baru, jadi `CACHE_NAME` sw.js tidak perlu naik.

129. **Tahapan calon siswa SPMB (6 Oktober 2026) — `src/lib/spmb-tahapan.ts` (netral) + `spmb-tahapan-server.ts`.**
     Keputusan rapat: calon punya daftar tahapan seperti "pencapaian", BERURUTAN, sama untuk semua gelombang:
     Pendaftaran → Verifikasi Berkas → **Ukuran Seragam (sengaja nomor 3, supaya pesanan terlihat — user)** → Asesmen Awal →
     Cek Fisik & Kesehatan → Pengumuman Hasil → Daftar Ulang & Pembayaran → "Resmi peserta MPLS" + info MPLS.
     - Satu sumber centang: `susunTahapan`/`tahapSelesai`/`tahapTerbuka` — dipakai halaman calon `/spmb/tahapan`, portal panitia
       `/pusat-spmb/tahapan` (`TahapanSpmbManager`), dan API. Tahap Pengumuman & Daftar Ulang bisa dimatikan
       (`spmb.tahapSeleksi`/`spmb.tahapDaftarUlang`); tanpa seleksi, menuntaskan cek kesehatan otomatis menyetel status DITERIMA
       supaya daftar ulang & konversi (yang menyaring DITERIMA) tetap jalan.
     - Calon TANPA akun: kunci = nomor + `tandaFormulir` (HMAC nomor|tanggal lahir) — `calonDariTanda`. Diterbitkan POST
       /api/admissions (layar sukses) & Cek Status jalur nomor+tanggal lahir; disimpan di localStorage perangkat calon.
     - **Asesmen & cek kesehatan = DATA SENSITIF**: tidak pernah ikut `/api/spmb/calon` maupun `/api/spmb/tahapan` (daftar).
       Dibaca hanya panitia (`/api/spmb/tahapan/[id]`) dan, setelah jadi siswa, halaman `/dashboard/teacher/students/[id]/spmb`
       (wali kelas siswa itu, Guru BK, Wakasek Kesiswaan, admin). Isian disimpan sebagai SALINAN label+nilai supaya tetap terbaca
       walau pertanyaan diubah. Isian bertanda `bukuInduk` (height/weight/bloodType/diseases) mengisi Buku Induk saat konversi.
     - Isian asesmen/pemeriksaan, ukuran seragam, dan info MPLS DISUSUN PANITIA (Pengaturan SPMB → Tahapan Calon); daftar di kode
       hanya bawaan. Tautan grup WA & jadwal tahap di sekolah melekat pada GELOMBANG (`tautanGrup`, `jadwalTahap`); tautan grup tampil
       tepat setelah daftar. Jumlah anggota grup hanya PERKIRAAN (calon menekan tombol / menyatakan bergabung) — WhatsApp tidak
       bisa dibaca situs.
     - Kabar ke calon = tombol WA/e-mail berisi pesan siap kirim (`pesanKabar`) dari layar panitia — tanpa layanan berbayar.
     - **Alur Pendaftaran di web = tahapan yang sama** (`susunAlurWeb`): judul & urutan dari `INFO_TAHAP`, ikut sakelar tahap;
       panitia hanya mengubah penjelasan/gambar per tahap (`spmb.alurTahap`). `spmb.alur` lama TIDAK dibaca lagi — jangan
       hidupkan editor langkah bebas, itu yang dulu membuat alur web & tahapan calon berbeda (user: "harusnya sama satu").
     - **Daftar ulang ≠ pembayaran.** Tahap Daftar Ulang = konfirmasi bersedia bersekolah (`daftarUlangConfirmedAt`, oleh calon
       atau panitia) + syarat bayar yang DIATUR panitia (`spmb.syaratBayar` TIDAK | UANG_MUKA [`spmb.uangMuka`] | LUNAS).
       Pembayaran = tabel `PembayaranSpmb`, BOLEH DICICIL dan boleh setelah MPLS / setelah jadi siswa: calon kirim bukti
       (MENUNGGU) → panitia SPMB/superadmin sahkan/tolak; panitia bisa mencatat tunai (langsung SAH). Total = Σ Rincian Biaya
       dikurangi `Admission.potonganBiaya`. Hitungan satu sumber `hitungBayar`/`denganBayar`. Menu lama Pusat SPMB "Daftar
       Ulang" & halaman publik `/daftar-ulang` kini PENGALIHAN ke Tahapan; `paymentVerified`/`buktiPembayaranUrl` hanya data
       lama (0 baris saat diganti). Modul Bendahara tidak disentuh — rekap lewat Excel `/api/spmb/tahapan/pembayaran`.
     - **Pendaftaran GRATIS; `GelombangSpmb.biayaDaftar` = BIAYA DAFTAR ULANG gelombang itu** (user 6 Okt 2026) dan itulah
       tagihan calon (`SetelanBayar.perGelombang`); Rincian Biaya hanya cadangan/rincian. Label di web, formulir cetak, dan
       pengaturan sudah "Biaya daftar ulang" — jangan dikembalikan ke "biaya pendaftaran".
     - **Kabar ke HP calon tanpa akun** (`src/lib/spmb-kabar.ts`): langganan push per pendaftar `LanggananSpmb` (bukan
       PushSubscription/User), log berkunci `KabarSpmb` (sekali per kejadian, tampil "Kabar terbaru" di halaman calon).
       Dipicu tindakan panitia di `/api/spmb/tahapan/[id]` (verifikasi, perbaikan, asesmen/kesehatan selesai, bayar
       sah/tolak/catat, daftar ulang, sesi) + "Buka Hasil" (`/api/spmb/pengaturan`), lewat `kirimLatar`. Pengingat
       `pengingatSpmb` (src/lib/pengingat-spmb.ts) jam `notifikasi.jamSpmb`: H-1 jadwal ke sekolah + tiap 3 hari bila
       tertahan (perbaikan/seragam/sesi/daftar ulang), hanya calon berlangganan, diam di hari libur, ikut Pratinjau.
     - **Sesi kedatangan** (`SesiSpmb`, per gelombang, berkuota; `Admission.sesiId`): dipilih calon setelah seragam, bisa
       diganti sampai asesmen dilakukan; kuota diperiksa dalam transaksi Serializable. Sesi MENGGANTIKAN jadwal umum gelombang
       untuk asesmen & cek kesehatan (`jadwalDenganSesi`). Sesi berpeserta tidak bisa dihapus.
     - **Data dobel yang DIHAPUS 6 Okt 2026 (user: "cari data yang double") — jangan dihidupkan lagi:** tautan grup WA umum
       `spmb.tautanGrup` (sekarang HANYA per gelombang, dan tidak tampil di halaman umum supaya grup berisi pendaftar saja);
       Jadwal Penting manual `spmb.jadwal` (diganti `susunJadwalWeb`: per gelombang dari tanggal gelombang, jadwal tahap/sesi,
       tanggal pengumuman, MPLS); isian skor lama "Nilai Rapor + Nilai Tes" bobot 60/40 di Pendaftar + `/api/admin/spmb-settings`
       (menimpa `skorAkhir` yang juga ditulis Seleksi & Nilai); tombol status lama WAWANCARA/ACCEPTED/REJECTED di Pendaftar
       (kini DITERIMA/CADANGAN/DITOLAK; `PUT /api/admin/admissions/[id]` menolak status di luar `STATUS_SPMB` dan tidak lagi
       menerima skor/pembayaran).
     - **Sapuan sampah 6 Okt 2026:** alur daftar ulang publik lama DIHAPUS (`DaftarUlangForm`, `/api/public/daftar-ulang/{verify,
       submit}` — siapa pun dengan nama+WA bisa menempel "bukti bayar" di luar pengesahan — `admission-token.ts`,
       `DaftarUlangSpmbManager`, `/api/spmb/daftar-ulang`), juga `GET /api/admissions` tanpa pemakai. Badge "pendaftar menunggu"
       (layout & dashboard admin, antrean portal, operator) = BERKAS belum diverifikasi, bukan status PENDING lama.
       Beranda Pusat SPMB memperingatkan persiapan tahapan yang belum diisi (grup WA & biaya per gelombang, sesi/jadwal, cara
       bayar, tanggal MPLS). Nama resmi: **Sistem** Penerimaan Murid Baru (Permendikdasmen 3/2025), bukan "Seleksi".
     - **Kuis Minat Jurusan = BANK SOAL panitia** (`spmb.kuis`, Pengaturan SPMB → Kuis Jurusan; `spmb.kuisJumlah` soal acak
       per kuis): tiap soal situasi umum, tiap pilihan → satu kode jurusan; diacak saat KLIK Mulai/Ulangi (`acakKuis`, bukan
       saat render — #15). Bank awal 20 soal DIISI KE DATABASE (bukan ditulis di kode, #11). Bank kosong = `susunKuis` lama.
     - **Disatukan 6 Okt 2026 (user setuju "satukan semua"):** (1) Persyaratan di web = berkas yang DIMINTA formulir
       (dokumen baku yang tidak disembunyikan + `DokumenSyaratSpmb` aktif, otomatis) + `spmb.syarat` khusus "dibawa saat
       daftar ulang"; (2) Cek Status jalur nomor+tanggal lahir langsung MENGALIHKAN ke /spmb/tahapan (jalur WA/e-mail tetap
       status ringkas); (3) menu Pendaftar DILEBUR ke Tahapan Calon — keputusan Terima/Cadangan/Tolak, cetak formulir, hapus,
       ekspor Data Pendaftar, NIK/NISN/jalur/perujuk/wilayah ada di jendela calon (`BarisKeputusan`); `/pusat-spmb/pendaftar`
       & `/dashboard/admin/admissions` = pengalihan, `PendaftarManager` & `GET /api/admin/admissions` dihapus; (4) "Pesan dari
       Panitia" (`Admission.notes`) tidak lagi diisi — pesan ke calon lewat perbaikan berkas & Kabari Calon. Tautan
       ringkasan Operator Sekolah (guru) dulu menunjuk `/dashboard/admin/admissions` yang tidak bisa dibuka guru (#45).
     - Ikut diperbaiki: konversi "Jadi Siswa" dulu hanya mengambil status `ACCEPTED` lama, padahal Pengumuman sejak 1 Okt menulis
       `DITERIMA` — pendaftar yang diterima lewat sistem baru tidak pernah muncul di sana.

130. **Nama sekolah asal = penulisan BAKU + satu kunci pembanding (6 Oktober 2026) — `src/lib/nama-sekolah.ts` (netral).**
     Permintaan user: nama sekolah sama tapi beda kapital/singkatan/tanda hubung/salah ketik harus bisa disatukan dan ditulis
     rapi ("SMP Negeri 1 Songgon", "MTs Negeri", "MTs Al Fatah" — singkatan SMPN/MTsN/SMPS DIBENTANGKAN, beda dari aturan lama
     `toProperCaseSchoolName` yang mempertahankan "SMPN").
     - `bakuNamaSekolah` = merapikan TULISAN saja (aman otomatis) — dipakai SEMUA jalur simpan sekolah asal: formulir SPMB,
       Buku Induk manual/impor/[id], persetujuan biodata siswa, kolom `kapital="sekolah"` di BukuIndukField, konversi SPMB.
       Jalur baru yang menyimpan nama sekolah WAJIB lewat fungsi ini, jangan `toProperCaseSchoolName` langsung.
     - `kunciSekolah` (tanpa apostrof/tanda baca: "Manba'ul" = "Manbaul") dipakai statistik asal sekolah & saran formulir.
     - `miripSekolah` = DUGAAN (salah ketik ≤1–2 huruf, berekor nama tempat ≥3 kata, angka sekolah harus sama) — HANYA saran;
       penggabungan selalu keputusan petugas di **Pusat SPMB → Rapikan Nama Sekolah** (`RapikanSekolahManager`,
       `/api/spmb/sekolah-asal`): tab Pendaftar SPMB (panitia) & Buku Induk Siswa (Admin + `BUKU_INDUK_FULL_JABATAN` saja).
       Kelompok "Pasti sama" boleh dirapikan sekaligus; "Mirip" dicentang satu per satu. Tiap penggabungan tercatat logActivity.
     - Formulir SPMB: `IsianSekolahAsal` menyarankan nama yang sudah dikenal (Buku Induk + pendaftar) lewat
       `/api/public/sekolah-asal` (hanya nama sekolah, disinggahkan 10 mnt, dibatasi per IP). Calon tetap boleh mengetik nama baru.
     - Data nyata saat dibuat: 213 penulisan di Buku Induk → 64 kelompok (mis. SMPN/SMP Negeri/Manbaul Manba'ul Falah = 424 siswa).
