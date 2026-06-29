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

1. **`export const dynamic = "force-dynamic"`** — wajib di setiap server component yang memanggil Prisma. Tanpa ini, Next.js bisa cache halaman dan data jadi stale.

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

10. **Kelas wali guru** — endpoint API guru wajib scope ke `teacher.homeroomOf` (bukan semua kelas). Fetch teacher dulu berdasarkan `session.email`, lalu ambil `homeroomOf`.
