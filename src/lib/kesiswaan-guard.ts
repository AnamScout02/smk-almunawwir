import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export const KESISWAAN_BK_JABATAN = ["Wakil Kepala Kesiswaan", "Guru BK"];

/** Wakil Kepala Kesiswaan & Guru BK boleh MELIHAT rekap absensi semua kelas (bukan cuma kelas
 * wali sendiri) — mereka butuh pantau kehadiran siswa lintas kelas utk keperluan pembinaan/BK.
 * TETAP TIDAK BOLEH INPUT/UBAH absensi — itu tetap khusus wali kelas (lihat
 * /api/teacher/attendance: fungsi baca vs tulis sengaja dipisah). */
export async function assertKesiswaanOrBk(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, KESISWAAN_BK_JABATAN);
}
