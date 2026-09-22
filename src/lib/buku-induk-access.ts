import "server-only";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { prisma } from "@/lib/prisma";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

/** Jabatan yang dapat akses PENUH Buku Induk (semua siswa & guru, termasuk impor massal) — sama
 * seperti TAS_JABATAN plus "Operator Sekolah" (staf yang tugasnya input data Dapodik/Buku Induk,
 * keputusan eksplisit user 2026-08-22: "operator bisa akses semua buku induk juga"). SENGAJA
 * dipisah dari TAS_JABATAN asli (bukan menambah Operator Sekolah ke situ) — supaya Operator
 * Sekolah TIDAK otomatis dapat akses ke modul TU lain yang tidak diminta (Persuratan,
 * Pengarsipan, Notulen Rapat, dst — itu tetap murni TAS_JABATAN via verifyTasAccess()). */
export const BUKU_INDUK_FULL_JABATAN = [...TAS_JABATAN, "Operator Sekolah"];

/** Sama seperti verifyTasAccess(), TAPI jabatan yang diterima ditambah "Operator Sekolah" —
 * dipakai KHUSUS endpoint/halaman Buku Induk (siswa maupun guru): create, import, template,
 * next-nis/next-nip. Bukan pengganti verifyTasAccess() di modul TU lain. */
export async function verifyBukuIndukFullAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN") return session;
  if (session.role === "TEACHER" || session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => BUKU_INDUK_FULL_JABATAN.includes(n))) return session;
  }
  redirect("/login");
}

export type BukuIndukSiswaScope = { scope: "ALL" } | { scope: "CLASS"; classIds: string[] };

/** Akses Buku Induk SISWA — lebih longgar dari verifyBukuIndukFullAccess(): ADMIN/TAS/Operator
 * Sekolah dapat scope "ALL" (semua kelas), WALI KELAS dapat scope "CLASS" (di-scope KETAT ke
 * kelas walinya saja — keputusan eksplisit user 2026-08-22: "wali kelas juga bisa akses buku
 * induk kelas masing2"). Guru yang bukan wali kelas & bukan Operator Sekolah TIDAK dapat akses
 * sama sekali. Dipakai KHUSUS endpoint baca/edit per-siswa (list, detail, PUT, export) — BUKAN
 * create/impor/template massal (itu tetap verifyBukuIndukFullAccess() murni, wali kelas tidak
 * boleh impor/buat siswa lintas kelas). Pemanggil WAJIB terapkan scope.classIds ke query Prisma
 * sendiri (lihat pola di route.ts) — fungsi ini cuma menentukan scope-nya, bukan filter query. */
export async function assertBukuIndukSiswaScope(): Promise<BukuIndukSiswaScope> {
  const session = await verifySession();
  if (session.role === "ADMIN") return { scope: "ALL" };
  if (session.role === "TEACHER" || session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => BUKU_INDUK_FULL_JABATAN.includes(n))) return { scope: "ALL" };
  }
  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: { homeroomOf: { select: { id: true } } },
    });
    if (teacher && teacher.homeroomOf.length > 0) {
      return { scope: "CLASS", classIds: teacher.homeroomOf.map(c => c.id) };
    }
  }
  redirect("/login");
}
