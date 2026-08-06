@AGENTS.md

# CLAUDE.md

Panduan ini membantu Claude Code saat bekerja di repositori ini.

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
- **jose** — JWT untuk session (disimpan di HttpOnly cookie `session`, expired 7 hari)
- **bcryptjs** — hash password
- **lucide-react** — ikon
- **Turbopack** dipakai saat `npm run dev` (bawaan Next.js 16)

## Auth & Session (PALING PENTING)

Session disimpan sebagai **JWT di cookie `session`** (HttpOnly, SameSite=lax).

```
src/lib/session.ts   ← encrypt/decrypt JWT, createSession, deleteSession, getSession
src/lib/dal.ts       ← verifySession(), verifyRole(["ADMIN"|"TEACHER"|"STUDENT"])
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
    - **Nilai & Absensi** (per keputusan eksplisit user): guru wali kelas boleh akses SEMUA mapel siswa di kelas walinya (`teacher.homeroomOf`). Guru mapel yang BUKAN wali kelas tetap boleh input Nilai/Absensi, TAPI KHUSUS untuk mapel yang benar-benar diampunya sesuai `TeachingAssignment` (`teacher.teachingLoad`) di kelas tsb — bukan bebas mapel apapun. Endpoint `/api/teacher/classes` (dipakai halaman Nilai & Absensi utama) sudah mengembalikan gabungan `homeroomOf` ∪ kelas dari `teachingLoad`; validasi per-mapel yang sebenarnya terjadi di `/api/teacher/grades` POST (cek `isAssignedSubject`) dan diterima bebas di `/api/teacher/attendance` (absensi tidak punya konsep mapel).
    - Modul lain (Jurnal Mengajar, Materi & Tugas, Ujian/Kuis) SUDAH dari awal berbasis `TeachingAssignment` (`/api/teacher/journal-classes`), bukan `homeroomOf` — pola ini yang dijadikan acuan saat memperluas Nilai/Absensi di atas.

11. **`Major` adalah satu-satunya sumber daftar jurusan** — JANGAN hardcode daftar jurusan (nama/kode) di halaman publik manapun. Selalu `prisma.major.findMany()` langsung di setiap tempat yang menampilkan daftar jurusan (homepage `Programs.tsx`, `/programs`, `/programs/[slug]`, `about/page.tsx`, `Footer.tsx`, form SPMB `AdmissionsForm.tsx` via `/api/public/majors`). `src/data/programs.ts` HANYA dipakai sebagai fallback ikon/warna Tailwind untuk 5 jurusan awal (TKJ/AK/ATU/DKV/DPIB) — kalau admin menambah jurusan baru lewat `/dashboard/admin/majors`, jurusan itu otomatis muncul di semua tempat tanpa perlu ubah kode, SELAMA kodenya query live dari DB.

12. **Fetch client-side wajib `.catch()`** — pola `fetch(...).then(...).then(data => { ...; setLoading(false); })` TANPA `.catch()` di akhir membuat spinner macet permanen selamanya kalau request gagal (network error, dsb). Selalu tutup chain dengan `.catch(() => {}).finally(() => setLoading(false))` (pisahkan `setLoading` dari isi `.then()` terakhir ke `.finally()`).

13. **Guard berbasis jabatan** — pola standar: buat `src/lib/<nama>-guard.ts` isinya `if (session.role === "TEACHER") await assertJabatan(session, ["Nama Jabatan"]);` (ADMIN & TAS otomatis lolos karena tidak masuk cabang `if`). Reuse pola ini kalau ada jabatan baru yang perlu akses modul tertentu — lihat `branding-guard.ts`, `uks-guard.ts`, `kedisiplinan-guard.ts`, dll sebagai contoh.

14. **Komponen manager + basePath / reuse lintas portal** — kalau sebuah fitur admin (misal Berita/Galeri/Banner) perlu juga bisa diakses guru dengan jabatan tertentu, JANGAN duplikasi kode. Ekstrak isi halaman jadi komponen di `src/components/shared/<Nama>Manager.tsx`, lalu buat wrapper tipis di kedua portal (`src/app/dashboard/admin/x/page.tsx` dan `src/app/dashboard/teacher/x/page.tsx`) yang cuma `return <XManager />`. Lihat `NewsManager`/`GalleryManager`/`BannerManager` (dipakai admin & guru Koordinator Publikasi) sebagai contoh terbaru.

15. **JANGAN generate ID unik pakai `Math.random()`/`crypto.randomUUID()` langsung di body komponen client** ("use client") yang di-render server-side (SSR) — nilainya beda antara render di server dan render di client, jadi elemen DOM yang butuh dicari lewat `document.getElementById(id)` di dalam `useEffect` TIDAK AKAN PERNAH ketemu (production React tidak memperbaiki atribut `id` yang mismatch saat hydration, beda dengan dev mode yang biasanya warning). Gejalanya diam-diam gagal: tidak ada error di console, tidak ada exception, komponen third-party (seperti ONLYOFFICE DocEditor) cuma tidak pernah render apa-apa. Kejadian nyata: `OnlyofficeEditor.tsx` awalnya pakai `useRef(`onlyoffice-${Math.random()...}`)`, diperbaiki jadi `useId()` bawaan React (didesain khusus stabil antara server & client). Selalu pakai `useId()` untuk kebutuhan ID unik semacam ini.
