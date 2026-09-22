import "server-only";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { assertJabatan, getJabatanNames } from "@/lib/jabatan-guard";

/** 3 varian jabatan bendahara yang sudah dipakai di app ini (org-chart `about/page.tsx`,
 * bucket KPI di `kpi-engine.ts`) — belum pernah jadi guard akses sampai modul ini dibuat. */
export const BENDAHARA_JABATAN = ["Bendahara Sekolah", "Bendahara BOS", "Bendahara BPOPP"];

/** ADMIN selalu lolos (tidak masuk cabang if). TEACHER/TAS wajib salah satu jabatan di atas.
 * JANGAN pakai `verifyTasAccess()` untuk modul ini — itu hardcode ke jabatan Tata Usaha, akan
 * salah menolak Bendahara yang bukan staf TU. Dipakai di API routes (throw FORBIDDEN). */
export async function assertBendahara(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, BENDAHARA_JABATAN);
}

/** Guard KHUSUS layout Server Component portal `/dashboard/bendahara/**` (redirect-based, bukan
 * throw-based) — pola persis `verifyAdminLayoutAccess()`/`verifyTasAccess()` di
 * tas-access-guard.ts. ADMIN selalu lolos; TEACHER/TAS wajib PUNYA (bukan "cuma punya") salah
 * satu jabatan Bendahara — pakai `.some()`, BUKAN `.every()`. Staf yang jabatannya Bendahara +
 * jabatan lain (mis. juga Wali Kelas) TETAP harus bisa buka portal ini lewat menu — `.every()`
 * cuma relevan utk keputusan REDIRECT OTOMATIS saat login (lihat `resolveRedirectTarget` di
 * auth.ts), bukan gerbang akses portal itu sendiri. Konsisten dgn `assertBendahara()` di atas
 * (yang juga `.some()` lewat `assertJabatan`). */
export async function verifyBendaharaLayoutAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN") return session;
  if (session.role === "TEACHER" || session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => BENDAHARA_JABATAN.includes(n))) return session;
  }
  redirect("/login");
}
