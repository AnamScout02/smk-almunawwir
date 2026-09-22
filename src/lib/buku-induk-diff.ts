import { SISWA_COLUMNS, type StudentRow } from "@/lib/buku-induk-siswa-columns";

/** Satu kolom Buku Induk yang berubah nilainya. */
export interface Perubahan { key: string; label: string; group: string; sebelum: string; sesudah: string }

/** Bandingkan dua versi data siswa memakai definisi kolom Buku Induk yang SAMA dengan tabel &
 * ekspor Excel (139 kolom). Sengaja memakai `SISWA_COLUMNS` alih-alih membandingkan field mentah:
 * labelnya sudah manusiawi, tanggal & kode (L/P, agama, dsb) sudah diformat, dan kalau nanti ada
 * kolom baru ditambahkan ke Buku Induk, riwayat perubahan ikut mencatatnya tanpa diubah lagi. */
/** Bentuk longgar yang keluar dari Prisma — `bukuIndukData` bertipe `JsonValue` (bisa string/array),
 * sedangkan kolom Buku Induk mengharapkan objek. Dirapikan di sini, bukan di setiap pemanggil. */
type SumberDiff = Omit<StudentRow, "bukuIndukData"> & { bukuIndukData?: unknown };

const rapikan = (s: SumberDiff): StudentRow => ({
  ...s,
  bukuIndukData: s.bukuIndukData && typeof s.bukuIndukData === "object" && !Array.isArray(s.bukuIndukData)
    ? (s.bukuIndukData as Record<string, unknown>) : null,
});

export function diffBukuIndukRaw(a: SumberDiff, b: SumberDiff): Perubahan[] {
  return diffBukuInduk(rapikan(a), rapikan(b));
}

export function diffBukuInduk(sebelum: StudentRow, sesudah: StudentRow): Perubahan[] {
  const hasil: Perubahan[] = [];
  for (const col of SISWA_COLUMNS) {
    let a = "", b = "";
    try { a = col.get(sebelum); } catch { a = ""; }
    try { b = col.get(sesudah); } catch { b = ""; }
    if (a !== b) hasil.push({ key: col.key, label: col.label, group: col.group, sebelum: a, sesudah: b });
  }
  return hasil;
}

/** Bentuk `select` Prisma yang memenuhi StudentRow — dipakai sebelum & sesudah update. */
export const DIFF_SELECT = {
  nis: true, nisn: true, birthPlace: true, birthDate: true, gender: true, religion: true,
  address: true, parentName: true, parentPhone: true, parentJob: true, previousSchool: true,
  enrollYear: true, studentStatus: true, exitDate: true, studentNotes: true, bukuIndukData: true,
  user: { select: { name: true, email: true } },
  class: { select: { name: true } },
  major: { select: { name: true } },
} as const;
