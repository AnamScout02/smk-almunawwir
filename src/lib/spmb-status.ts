/** Label status pendaftar SPMB — netral (dipakai halaman publik, portal, dan API status). */
export const STATUS_SPMB = ["PENDING", "VERIFIKASI", "DITERIMA", "CADANGAN", "DITOLAK"] as const;

export const LABEL_STATUS: Record<string, string> = {
  PENDING: "Berkas masuk",
  VERIFIKASI: "Berkas sedang diperiksa",
  DITERIMA: "Diterima",
  CADANGAN: "Cadangan",
  DITOLAK: "Belum diterima",
  // Status lama yang masih tersimpan di baris pendaftar sebelum 1 Oktober 2026.
  ACCEPTED: "Diterima",
  REJECTED: "Belum diterima",
};
