import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function assertJaringan(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, ["Pengelola Jaringan Sekolah"]);
}

/** Versi tanpa lemparan — dipakai halaman gabungan Jaringan & Layar untuk memutuskan tab mana yang
 * ditampilkan (27 September 2026). Satu halaman itu dibuka dua kalangan dengan hak berbeda: pengelola
 * sarana prasarana (layar & perangkat) dan Pengelola Jaringan Sekolah (router, hotspot, mode ujian),
 * jadi aksesnya perlu dibaca sebagai nilai, bukan sebagai penolakan. */
export async function bolehJaringan(session: { role: string; email: string }): Promise<boolean> {
  try { await assertJaringan(session); return true; } catch { return false; }
}
