import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

/** Siapa yang boleh melihat CCTV (24 September 2026).
 *
 * Sengaja SEMPIT: rekaman kamera sekolah bukan tontonan umum. ADMIN & TAS lolos (tidak masuk cabang `if`,
 * pola guard baku CLAUDE.md #13); guru hanya bila memegang jabatan pimpinan/kesiswaan/sarpras yang memang
 * butuh melihat keadaan sekolah. Setiap pembukaan layar CCTV tercatat di Log Aktivitas. */
export const JABATAN_CCTV = [
  "Kepala Sekolah",
  "Wakil Kepala Kesiswaan",
  "Wakil Kepala Sarana Prasarana",
];

export async function assertCctv(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, JABATAN_CCTV);
}

/** Versi tanpa lemparan — dipakai halaman gabungan Jaringan & Layar untuk memutuskan apakah tab CCTV
 * ditampilkan (27 September 2026). Guard CCTV sengaja lebih SEMPIT daripada `aksesSarpras`, jadi haknya
 * tidak boleh disamakan dengan tab Layar & Perangkat. */
export async function bolehCctv(session: { role: string; email: string }): Promise<boolean> {
  try { await assertCctv(session); return true; } catch { return false; }
}
