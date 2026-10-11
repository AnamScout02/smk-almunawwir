/** ASAL catatan Presensi Pegawai (netral — dipakai layar klien & server). Aturannya di src/lib/presensi-turunan.ts. */
export const SUMBER_TURUNAN = ["PIKET", "JURNAL"];
export const LABEL_SUMBER: Record<string, string> = {
  TU: "Tata Usaha", QR: "Pindai QR", KARTU: "Pindai kartu", KEGIATAN: "Hadir kegiatan",
  PIKET: "Turunan · catatan piket", JURNAL: "Turunan · jurnal mengajar",
  CUTI: "Cuti disetujui", SURAT_TUGAS: "Surat tugas",
};
export const GAYA_SUMBER: Record<string, string> = {
  TU: "bg-primary-50 text-primary-700 border-primary-100",
  QR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  KARTU: "bg-emerald-50 text-emerald-700 border-emerald-200",
  KEGIATAN: "bg-blue-50 text-blue-700 border-blue-200",
  PIKET: "bg-amber-50 text-amber-700 border-amber-200",
  JURNAL: "bg-amber-50 text-amber-700 border-amber-200",
  CUTI: "bg-purple-50 text-purple-700 border-purple-200",
  SURAT_TUGAS: "bg-purple-50 text-purple-700 border-purple-200",
};
