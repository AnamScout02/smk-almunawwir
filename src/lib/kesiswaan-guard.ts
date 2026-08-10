import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";
import { isOnDutyToday } from "@/lib/kedisiplinan-guard";

export const KESISWAAN_BK_JABATAN = ["Wakil Kepala Kesiswaan", "Guru BK"];

/** Wakil Kepala Kesiswaan & Guru BK boleh MELIHAT rekap absensi semua kelas (bukan cuma kelas
 * wali sendiri) — mereka butuh pantau kehadiran siswa lintas kelas utk keperluan pembinaan/BK.
 * TETAP TIDAK BOLEH INPUT/UBAH absensi — itu tetap khusus wali kelas (lihat
 * /api/teacher/attendance: fungsi baca vs tulis sengaja dipisah). */
export async function assertKesiswaanOrBk(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, KESISWAAN_BK_JABATAN);
}

// ── Poin Pelanggaran & Prestasi Siswa (Tata Tertib) — request BK 2026-08-10 ─────────────────
/** Akses PENUH (semua jenis pelanggaran/prestasi, lihat riwayat semua siswa, kelola daftar
 * jenis) — khusus BK & Wakasek Kesiswaan (pakai assertKesiswaanOrBk yg sudah ada di atas,
 * ADMIN otomatis lolos lewat assertJabatan). Guru piket TIDAK termasuk ini. */
export const assertStudentPointsFull = assertKesiswaanOrBk;

/** Guru Piket (siapa pun yg terjadwal piket HARI INI) boleh INPUT poin TAPI cuma utk jenis
 * pelanggaran yg ditandai piketAllowed=true (Terlambat & seragam/atribut) — divalidasi lagi di
 * route POST terhadap StudentViolationType.piketAllowed, guard ini cuma memastikan orangnya
 * memang piket hari ini/BK/Kesiswaan/Admin, bukan guru mapel sembarangan. */
export async function assertPiketOrKesiswaanBk(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  try {
    await assertKesiswaanOrBk(session);
    return;
  } catch {
    // Bukan BK/Kesiswaan — lanjut cek piket hari ini.
  }
  if (session.role !== "TEACHER" && session.role !== "TAS") throw new Error("FORBIDDEN");
  if (!(await isOnDutyToday(session.email))) throw new Error("FORBIDDEN");
}
