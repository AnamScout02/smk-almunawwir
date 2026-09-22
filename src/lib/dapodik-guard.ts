import "server-only";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

export const JABATAN_OPERATOR_SEKOLAH = "Operator Sekolah";

/** AKSES SINKRON DAPODIK (17 Sep 2026 — permintaan user: "operator bisa akses full halaman ini").
 * - Administrator & jabatan Operator Sekolah (akun Guru maupun Staf TU): akses penuh, termasuk mengubah alamat, IP, dan kunci.
 * - Staf Tata Usaha (TAS_JABATAN): melihat, tes koneksi, bandingkan, dan unduh daftar — tanpa mengubah pengaturan.
 * Selain itu dialihkan ke halaman masuk (pola sama verifyTasAccess). */
export async function verifyDapodikAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN") return { session, bolehUbah: true };
  if (session.role === "TEACHER" || session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    const operator = names.includes(JABATAN_OPERATOR_SEKOLAH);
    if (operator || names.some(n => TAS_JABATAN.includes(n))) return { session, bolehUbah: operator };
  }
  redirect("/login");
}
