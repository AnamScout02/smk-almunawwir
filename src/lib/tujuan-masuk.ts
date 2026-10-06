import "server-only";
import { cookies } from "next/headers";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { BENDAHARA_JABATAN } from "@/lib/bendahara-guard";

/* Tujuan setelah berhasil masuk — dipakai login sandi (src/app/actions/auth.ts) DAN masuk dengan passkey
   (/api/passkey/masuk/verifikasi). Dipindah dari berkas "use server" (5 Okt 2026): fungsi yang diekspor dari
   sana otomatis menjadi server action yang bisa dipanggil dari luar. */

export const REDIRECT_MAP: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  TAS: "/dashboard/admin",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
  PARENT: "/dashboard/parent",
};

/** Staf (TEACHER/TAS) yang jabatannya CUMA Bendahara (Sekolah/BOS/BPOPP — tidak ada jabatan lain
 * sama sekali) langsung diarahkan ke portal Bendahara sendiri begitu login, bukan lewat Dashboard
 * Guru/Admin dulu — keputusan eksplisit user 2026-08-28. Kalau punya jabatan lain juga, tetap ke
 * dashboard biasa (menu "Bendahara" tetap ada di situ sbg pintu masuk tambahan). ADMIN/STUDENT/
 * PARENT tidak pernah kena override ini (jabatan cuma berlaku utk TEACHER/TAS). */
export async function resolveRedirectTarget(role: string, email: string): Promise<string> {
  const base = REDIRECT_MAP[role] ?? "/dashboard/student";
  if (role === "TEACHER" || role === "TAS") {
    const names = await getJabatanNames(email);
    if (names.length > 0 && names.every(n => BENDAHARA_JABATAN.includes(n))) return "/dashboard/bendahara";
  }
  return base;
}

/** Tujuan setelah masuk yang dititipkan tautan QR (cookie `lanjut_masuk`, 10 menit). Hanya jalur internal
 * berawalan /aset/ atau /hadir/ (presensi kegiatan) — bukan pengalihan bebas (open redirect). */
export async function ambilLanjut(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get("lanjut_masuk")?.value;
  if (!v) return null;
  jar.delete("lanjut_masuk");
  return /^\/aset\/[A-Za-z0-9_-]{1,40}$/.test(v) || /^\/hadir\/[A-Za-z0-9_-]{1,40}\?t=\d{1,12}\.[A-Za-z0-9_-]{1,32}$/.test(v) ? v : null;
}

