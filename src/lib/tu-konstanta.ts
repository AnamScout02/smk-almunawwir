/** Konstanta bersama modul Tata Usaha (Surat Keterangan, Cuti, Bantuan Siswa, Rapor, Kenaikan
 * Kelas). Ditaruh di satu file supaya label yang muncul di form, tabel, dan hasil cetak TIDAK
 * pernah beda antar halaman. File ini SENGAJA tanpa "server-only": dipakai client & server. */

// ===== Surat Keterangan =====
export const JENIS_SURAT = [
  { value: "AKTIF", label: "Keterangan Aktif Sekolah", judul: "SURAT KETERANGAN AKTIF SEKOLAH", klasifikasi: "B.2" },
  { value: "KELAKUAN_BAIK", label: "Keterangan Kelakuan Baik", judul: "SURAT KETERANGAN KELAKUAN BAIK", klasifikasi: "B.2" },
  { value: "PINDAH", label: "Keterangan Pindah Sekolah", judul: "SURAT KETERANGAN PINDAH SEKOLAH", klasifikasi: "B.3" },
  { value: "LULUS", label: "Keterangan Lulus", judul: "SURAT KETERANGAN LULUS", klasifikasi: "B.2" },
] as const;

export function suratMeta(jenis: string) {
  return JENIS_SURAT.find(j => j.value === jenis) ?? JENIS_SURAT[0];
}

// ===== Cuti Pegawai =====
/** Kuota cuti TAHUNAN mengikuti ketentuan umum ASN: 12 hari kerja per tahun takwim. Jenis cuti
 * lain (sakit, melahirkan, dst) TIDAK memotong kuota ini — masing-masing punya aturan sendiri,
 * makanya `potongKuota` dipisah per jenis, bukan dihitung dari total semua cuti. */
export const KUOTA_CUTI_TAHUNAN = 12;

export const JENIS_CUTI = [
  { value: "TAHUNAN", label: "Cuti Tahunan", potongKuota: true },
  { value: "SAKIT", label: "Cuti Sakit", potongKuota: false },
  { value: "MELAHIRKAN", label: "Cuti Melahirkan", potongKuota: false },
  { value: "PENTING", label: "Cuti Alasan Penting", potongKuota: false },
  { value: "BESAR", label: "Cuti Besar", potongKuota: false },
  { value: "DILUAR_TANGGUNGAN", label: "Cuti di Luar Tanggungan", potongKuota: false },
] as const;

export function cutiMeta(jenis: string) {
  return JENIS_CUTI.find(j => j.value === jenis) ?? JENIS_CUTI[0];
}

export const STATUS_CUTI = [
  { value: "DIAJUKAN", label: "Diajukan", style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "DISETUJUI", label: "Disetujui", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "DITOLAK", label: "Ditolak", style: "bg-red-50 text-red-600 border-red-200" },
] as const;

/** Jumlah HARI KERJA (Senin-Sabtu, sekolah ini masuk Sabtu) antara dua tanggal, inklusif.
 * Minggu tidak dihitung. Dipakai untuk mengisi otomatis lama cuti saat tanggal dipilih. */
export function hitungHariKerja(mulai: string, selesai: string): number {
  if (!mulai || !selesai) return 0;
  const a = new Date(mulai), b = new Date(selesai);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) n++; // 0 = Minggu
  }
  return n;
}

// ===== Bantuan / Beasiswa Siswa =====
export const JENIS_BANTUAN = [
  { value: "PIP", label: "PIP (Program Indonesia Pintar)" },
  { value: "KIP", label: "KIP (Kartu Indonesia Pintar)" },
  { value: "BEASISWA_LAIN", label: "Beasiswa Lainnya" },
] as const;

export const STATUS_AMBIL = [
  { value: "BELUM", label: "Belum Diambil", style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "SUDAH", label: "Sudah Diambil", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
] as const;

// ===== Penerimaan Rapor =====
export const SEMESTER_OPTIONS = [
  { value: "GANJIL", label: "Semester Ganjil" },
  { value: "GENAP", label: "Semester Genap" },
] as const;

export const HUBUNGAN_PENGAMBIL = [
  { value: "Ayah", label: "Ayah" },
  { value: "Ibu", label: "Ibu" },
  { value: "Wali", label: "Wali" },
  { value: "Siswa Sendiri", label: "Siswa Sendiri" },
  { value: "Lainnya", label: "Lainnya" },
] as const;

// ===== Kenaikan Kelas =====
export const KEPUTUSAN_KENAIKAN = [
  { value: "NAIK", label: "Naik Kelas", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "TINGGAL", label: "Tinggal Kelas", style: "bg-red-50 text-red-600 border-red-200" },
  { value: "LULUS", label: "Lulus", style: "bg-blue-50 text-blue-700 border-blue-200" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], v: string): string {
  return list.find(x => x.value === v)?.label ?? v;
}

export function styleOf(list: readonly { value: string; style?: string }[], v: string): string {
  return list.find(x => x.value === v)?.style ?? "bg-gray-50 text-gray-600 border-gray-200";
}

export const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

// ─────────────────────────────────────────────────────────────────────────────
// Tahap 3 (13 September 2026) — Disposisi, Ekspedisi, Surat Tugas, Ijazah,
// Presensi Pegawai, Kalender Pendidikan
// ─────────────────────────────────────────────────────────────────────────────

/** Sifat surat pada lembar disposisi — urut dari paling longgar ke paling mendesak. */
export const SIFAT_DISPOSISI = [
  { value: "BIASA",         label: "Biasa",         style: "bg-gray-50 text-gray-600 border-gray-200" },
  { value: "SEGERA",        label: "Segera",        style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "SANGAT_SEGERA", label: "Sangat Segera", style: "bg-red-50 text-red-600 border-red-200" },
  { value: "RAHASIA",       label: "Rahasia",       style: "bg-purple-50 text-purple-700 border-purple-200" },
] as const;

export const STATUS_DISPOSISI = [
  { value: "BARU",     label: "Belum Ditindaklanjuti", style: "bg-red-50 text-red-600 border-red-200" },
  { value: "DIPROSES", label: "Sedang Diproses",       style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "SELESAI",  label: "Selesai",               style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
] as const;

/** Tujuan disposisi yang paling sering dipakai — tetap bisa diketik bebas di formnya. */
export const TUJUAN_DISPOSISI_UMUM = [
  "Wakil Kepala Bidang Kurikulum",
  "Wakil Kepala Bidang Kesiswaan",
  "Wakil Kepala Bidang Sarana Prasarana",
  "Wakil Kepala Bidang Hubungan Masyarakat",
  "Kepala Tenaga Administrasi Sekolah",
  "Bendahara Sekolah",
  "Kepala Program Keahlian",
  "Wali Kelas",
  "Guru BK",
  "Arsip",
];

export const CARA_KIRIM = [
  { value: "LANGSUNG", label: "Diantar Langsung" },
  { value: "POS",      label: "Pos" },
  { value: "KURIR",    label: "Kurir / Ekspedisi" },
  { value: "EMAIL",    label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

export const STATUS_EKSPEDISI = [
  { value: "DIKIRIM",  label: "Dikirim",  style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "DITERIMA", label: "Diterima", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
] as const;

export const SUMBER_BIAYA = [
  { value: "BOS",      label: "Dana BOS" },
  { value: "KOMITE",   label: "Dana Komite" },
  { value: "YAYASAN",  label: "Yayasan" },
  { value: "MANDIRI",  label: "Biaya Sendiri" },
  { value: "PENGUNDANG", label: "Ditanggung Pengundang" },
  { value: "LAINNYA",  label: "Lainnya" },
] as const;

export const DOKUMEN_IJAZAH = [
  { value: "IJAZAH",  label: "Ijazah" },
  { value: "SKHUN",   label: "SKHUN / SKHU" },
  { value: "SKL",     label: "Surat Keterangan Lulus" },
  { value: "RAPOR",   label: "Buku Rapor" },
  { value: "AKTA",    label: "Akta Kelahiran" },
  { value: "KK",      label: "Kartu Keluarga" },
  { value: "LAINNYA", label: "Dokumen Lain" },
] as const;

export const PENGAMBIL_IJAZAH = [
  { value: "SENDIRI",    label: "Alumni Sendiri" },
  { value: "ORANG_TUA",  label: "Orang Tua" },
  { value: "WALI",       label: "Wali" },
  { value: "DIWAKILKAN", label: "Diwakilkan (Surat Kuasa)" },
] as const;

/** Status kehadiran pegawai. SENGAJA tidak memuat nilai default — dropdown-nya wajib
 * mulai kosong (aturan tetap aplikasi ini, lihat CLAUDE.md gotcha #10). */
export const STATUS_PRESENSI_PEGAWAI = [
  { value: "HADIR",      label: "Hadir",      style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "IZIN",       label: "Izin",       style: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "SAKIT",      label: "Sakit",      style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "DINAS_LUAR", label: "Dinas Luar", style: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "CUTI",       label: "Cuti",       style: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "ALPHA",      label: "Tanpa Keterangan", style: "bg-red-50 text-red-600 border-red-200" },
] as const;

export const JENIS_AGENDA = [
  { value: "KBM",      label: "Kegiatan Belajar", style: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "#10b981" },
  { value: "UJIAN",    label: "Ujian / Penilaian", style: "bg-amber-50 text-amber-700 border-amber-200",      dot: "#f59e0b" },
  { value: "LIBUR",    label: "Libur",             style: "bg-red-50 text-red-600 border-red-200",            dot: "#ef4444" },
  { value: "KEGIATAN", label: "Kegiatan Sekolah",  style: "bg-blue-50 text-blue-700 border-blue-200",         dot: "#3b82f6" },
  { value: "RAPAT",    label: "Rapat",             style: "bg-purple-50 text-purple-700 border-purple-200",   dot: "#a855f7" },
  { value: "PPDB",     label: "SPMB",       style: "bg-cyan-50 text-cyan-700 border-cyan-200",         dot: "#06b6d4" },
  { value: "LAINNYA",  label: "Lainnya",           style: "bg-gray-50 text-gray-600 border-gray-200",         dot: "#9ca3af" },
] as const;

/** Status permintaan surat yang diajukan sendiri lewat portal siswa/orang tua. */
export const STATUS_PERMINTAAN = [
  { value: "DIAJUKAN",  label: "Menunggu Diproses", style: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "DISETUJUI", label: "Disetujui",         style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "DITOLAK",   label: "Ditolak",           style: "bg-red-50 text-red-600 border-red-200" },
] as const;
