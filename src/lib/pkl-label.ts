/** Label & hitungan netral modul PKL (9 Okt 2026) — TANPA `server-only`, dipakai layar klien, API, dan Excel. */

export const STATUS_PKL: Record<string, { label: string; kelas: string }> = {
  ONGOING: { label: "Sedang PKL", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  COMPLETED: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", kelas: "bg-red-50 text-red-600 border-red-200" },
};

/** Lama PKL yang lazim. Lama lain tetap bisa: tanggal selesai boleh diubah tangan. */
export const PILIHAN_LAMA = [3, 6] as const;

/** Tanggal selesai = mulai + N bulan − 1 hari (mulai 1 Juli, 3 bulan → 30 September). Masukan & keluaran "YYYY-MM-DD". */
export function selesaiDari(mulai: string, bulan: number): string {
  const [y, m, d] = mulai.split("-").map(Number);
  if (!y || !m || !d || !bulan) return "";
  const t = new Date(Date.UTC(y, m - 1 + bulan, d));
  // Tanggal 31 + bulan yang lebih pendek meluber ke bulan berikutnya — tarik ke akhir bulan yang dimaksud.
  if (t.getUTCDate() !== d) t.setUTCDate(0);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export const JENIS_LAPORAN: Record<string, string> = {
  DARURAT: "Keadaan darurat", SAKIT: "Sakit", KECELAKAAN: "Kecelakaan kerja", PELANGGARAN: "Pelanggaran / kedisiplinan",
  TIDAK_COCOK: "Tidak cocok dengan tempat PKL", LAINNYA: "Lainnya",
};
export const STATUS_LAPORAN: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Baru", kelas: "bg-red-50 text-red-600 border-red-200" },
  DITANGANI: { label: "Ditangani", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/** Keadaan MoU dari tanggal berakhirnya — dihitung, tidak disimpan. */
export function keadaanMou(sampai: string | Date | null | undefined, kini = new Date()): { kode: "TANPA" | "AKTIF" | "SEGERA" | "HABIS"; label: string; kelas: string } {
  if (!sampai) return { kode: "TANPA", label: "Belum ada MoU", kelas: "bg-gray-50 text-gray-500 border-gray-200" };
  const t = new Date(sampai).getTime(), sisa = Math.ceil((t - kini.getTime()) / 86_400_000);
  if (sisa < 0) return { kode: "HABIS", label: "MoU habis", kelas: "bg-red-50 text-red-600 border-red-200" };
  if (sisa <= 60) return { kode: "SEGERA", label: `MoU habis ${sisa} hari lagi`, kelas: "bg-amber-50 text-amber-700 border-amber-200" };
  return { kode: "AKTIF", label: "MoU aktif", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export const tglPkl = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export function predikatPkl(n: number) {
  return n >= 90 ? "Sangat Baik" : n >= 80 ? "Baik" : n >= 70 ? "Cukup" : "Kurang";
}
