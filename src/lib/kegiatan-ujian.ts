/** KEGIATAN UJIAN — daftar jenis & aturan penamaan. Aman dipakai di klien maupun server. */

export interface JenisKegiatan {
  value: string;
  singkatan: string;
  /** Nama dasar; semester (Ganjil/Genap) ditambahkan otomatis untuk jenis yang per semester. */
  nama: string;
  perSemester: boolean;
  /** Tingkat yang lazim — hanya usulan awal di formulir, tetap boleh diubah. */
  tingkatLazim: number[];
}

/** Istilah mengikuti Kurikulum Merdeka & Kalender Pendidikan sekolah (kode STS/SAS/PSAJ/UKK
 * di kalender matriks). */
export const JENIS_KEGIATAN: JenisKegiatan[] = [
  { value: "STS", singkatan: "STS", nama: "Sumatif Tengah Semester", perSemester: true, tingkatLazim: [] },
  { value: "SAS", singkatan: "SAS", nama: "Sumatif Akhir Semester", perSemester: true, tingkatLazim: [] },
  { value: "SAT", singkatan: "SAT", nama: "Sumatif Akhir Tahun", perSemester: false, tingkatLazim: [10, 11] },
  { value: "PSAJ", singkatan: "PSAJ", nama: "Penilaian Sumatif Akhir Jenjang", perSemester: false, tingkatLazim: [12] },
  { value: "UKK", singkatan: "UKK", nama: "Uji Kompetensi Keahlian", perSemester: false, tingkatLazim: [12] },
  { value: "REMEDIAL", singkatan: "REMED", nama: "Ujian Remedial", perSemester: true, tingkatLazim: [] },
  { value: "TRYOUT", singkatan: "TO", nama: "Try Out", perSemester: false, tingkatLazim: [12] },
  { value: "LAINNYA", singkatan: "", nama: "", perSemester: false, tingkatLazim: [] },
];

export const jenisKegiatan = (v: string) => JENIS_KEGIATAN.find(j => j.value === v) ?? JENIS_KEGIATAN[JENIS_KEGIATAN.length - 1];

export const labelSemester = (s: string | null | undefined) => s === "GANJIL" ? "Ganjil" : s === "GENAP" ? "Genap" : "";

/** Nama usulan dari jenis + semester, mis. ("STS","GANJIL") → "Sumatif Tengah Semester Ganjil". */
export function namaUsulan(jenis: string, semester: string | null | undefined): string {
  const j = jenisKegiatan(jenis);
  if (!j.nama) return "";
  return j.perSemester && labelSemester(semester) ? `${j.nama} ${labelSemester(semester)}` : j.nama;
}

/** Kata kunci judul agenda Kalender Pendidikan per jenis — untuk mengambil tanggal pelaksanaan
 * dari kalender (judul agenda di sekolah tidak selalu memakai kode, mis. "Kegiatan Sumatif Akhir
 * Semester Ganjjil"). */
export const POLA_KALENDER: Record<string, RegExp> = {
  STS: /sumatif\s+tengah\s+semester/i,
  SAS: /sumatif\s+akhir\s+semester/i,
  SAT: /sumatif\s+akhir\s+tahun/i,
  PSAJ: /sumatif\s+akhir\s+jenjang|\bpsaj\b/i,
  UKK: /\bukk\b|uji\s+kompetensi/i,
};

export interface KegiatanRingkas {
  id: string; jenis: string; nama: string; singkatan: string;
  semester: string | null; academicYearId: string | null; tahunAjaran: string | null; tingkat: number[];
  tanggalMulai: string | null; tanggalSelesai: string | null; aktif: boolean;
  /** Token bersama kegiatan — satu token untuk semua mapel di kegiatan ini. Null = belum dibuat. */
  token: string | null;
  /** Berganti otomatis tiap N menit (0 = tidak). */
  tokenOtomatisMenit: number;
  /** Kapan token berikutnya berganti (ISO) — null bila tidak berjangka. */
  tokenBerganti: string | null;
  /** RUANG = peserta dibagi ke ruang ujian (Denah Ruang); KELAS = di kelas masing-masing, jam per kelas, pengawas guru mapel. */
  mekanisme: "RUANG" | "KELAS";
}

/** Keterangan baris kedua: "Semester Ganjil · Tahun Ajaran 2026/2027". */
export function keteranganKegiatan(k: { semester: string | null; tahunAjaran: string | null }): string {
  return [labelSemester(k.semester) ? `Semester ${labelSemester(k.semester)}` : "", k.tahunAjaran ? `Tahun Ajaran ${k.tahunAjaran}` : ""]
    .filter(Boolean).join(" · ");
}
