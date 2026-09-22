/** Tanggal keluar siswa — SATU sumber kebenaran untuk seluruh aplikasi.
 *
 * MASALAH YANG DIPECAHKAN (temuan audit 2026-09-12): tanggal keluar siswa tersimpan di DUA
 * tempat berbeda dan bagian aplikasi yang berbeda membaca yang berbeda pula —
 *   - Form Buku Induk MENULIS ke `bukuIndukData.pindahDate` (JSON)   -> 166 siswa terisi
 *   - Buku Mutasi MEMBACA dari kolom `Student.exitDate`               -> 0 siswa terisi
 * Akibatnya Buku Mutasi (buku resmi sekolah) menampilkan 0 siswa masuk & 0 siswa keluar
 * selamanya, padahal datanya ada. Buku Klapper sempat kena jebakan yang sama.
 *
 * Sekarang: kolom `exitDate` tetap diisi (lihat sinkronisasi di api buku-induk/siswa), TAPI semua
 * pembaca WAJIB lewat fungsi ini supaya data lama/impor yang cuma punya `pindahDate` tetap
 * terbaca. JANGAN membaca `student.exitDate` langsung di kode baru. */

export interface ExitDateSource {
  exitDate?: Date | string | null;
  bukuIndukData?: unknown;
}

/** Ambil `pindahDate` (atau `graduationDate` untuk yang lulus) dari JSON bukuIndukData. */
function fromBukuInduk(data: unknown, key: string): Date | null {
  if (!data || typeof data !== "object") return null;
  const v = (data as Record<string, unknown>)[key];
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Tanggal siswa berhenti/pindah/lulus. Urutan: kolom exitDate -> pindahDate -> graduationDate. */
export function resolveExitDate(s: ExitDateSource): Date | null {
  if (s.exitDate) {
    const d = s.exitDate instanceof Date ? s.exitDate : new Date(s.exitDate);
    if (!isNaN(d.getTime())) return d;
  }
  return fromBukuInduk(s.bukuIndukData, "pindahDate") ?? fromBukuInduk(s.bukuIndukData, "graduationDate");
}

/** Tahun ajaran (mulai Juli) yang memuat sebuah tanggal: 2025-10-25 -> 2025 (TP 2025/2026). */
export function academicYearStartOf(d: Date): number {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}
