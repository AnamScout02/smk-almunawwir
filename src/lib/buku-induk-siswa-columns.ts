/** Definisi kolom tabel lengkap Buku Induk Siswa — dipakai bersama oleh halaman tabel on-screen
 * dan endpoint export Excel, supaya urutan & label kolom selalu sinkron di kedua tempat.
 * Kolom mengikuti persis urutan section A-M pada form edit Buku Induk Siswa. */

export interface StudentRow {
  nis: string; nisn?: string | null;
  birthPlace?: string | null; birthDate?: Date | string | null;
  gender?: string | null; religion?: string | null;
  address?: string | null; parentName?: string | null; parentPhone?: string | null; parentJob?: string | null;
  previousSchool?: string | null; enrollYear?: number | null; studentStatus?: string | null;
  exitDate?: Date | string | null; studentNotes?: string | null;
  bukuIndukData?: Record<string, unknown> | null;
  user: { name: string; email: string };
  class?: { name: string } | null;
  major: { name: string };
}

const b = (s: StudentRow, key: string): string => {
  const v = s.bukuIndukData?.[key];
  if (Array.isArray(v)) return String(v.length);
  return v === undefined || v === null || v === "" ? "" : String(v);
};
const tgl = (v?: string | Date | null): string => {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};
const genderLabel = (v?: string | null) => v === "L" ? "Laki-laki" : v === "P" ? "Perempuan" : "";
/** Nama kabupaten/kota tanpa kata "Kabupaten"/"Kota" di depan — labelnya sudah menyebut "Kabupaten/Kota". */
const kabupatenName = (v: string) => v.replace(/^(Kabupaten|Kota)\s+/i, "");

export interface ColDef { key: string; label: string; group: string; get: (s: StudentRow) => string }

export const SISWA_COLUMNS: ColDef[] = [
  // A. Keterangan Siswa
  { key: "nis", label: "NIS", group: "A. Keterangan Siswa", get: s => s.nis },
  { key: "nisn", label: "NISN", group: "A. Keterangan Siswa", get: s => s.nisn ?? "" },
  { key: "nik", label: "NIK", group: "A. Keterangan Siswa", get: s => b(s, "nik") },
  { key: "nama", label: "Nama Lengkap", group: "A. Keterangan Siswa", get: s => s.user.name },
  { key: "nickname", label: "Nama Panggilan", group: "A. Keterangan Siswa", get: s => b(s, "nickname") },
  { key: "gender", label: "Jenis Kelamin", group: "A. Keterangan Siswa", get: s => genderLabel(s.gender) },
  { key: "birthPlace", label: "Tempat Lahir", group: "A. Keterangan Siswa", get: s => s.birthPlace ?? "" },
  { key: "birthDate", label: "Tanggal Lahir", group: "A. Keterangan Siswa", get: s => tgl(s.birthDate) },
  { key: "religion", label: "Agama", group: "A. Keterangan Siswa", get: s => s.religion ?? "" },
  { key: "citizenship", label: "Kewarganegaraan", group: "A. Keterangan Siswa", get: s => b(s, "citizenship") },
  { key: "childOrder", label: "Anak Ke", group: "A. Keterangan Siswa", get: s => b(s, "childOrder") },
  { key: "siblingsCount", label: "Jml Saudara Kandung", group: "A. Keterangan Siswa", get: s => b(s, "siblingsCount") },
  { key: "halfSiblings", label: "Jml Saudara Tiri", group: "A. Keterangan Siswa", get: s => b(s, "halfSiblings") },
  { key: "adoptedSiblings", label: "Jml Saudara Angkat", group: "A. Keterangan Siswa", get: s => b(s, "adoptedSiblings") },
  { key: "orphanStatus", label: "Yatim/Piatu", group: "A. Keterangan Siswa", get: s => b(s, "orphanStatus") },
  { key: "dailyLanguage", label: "Bahasa Sehari-hari", group: "A. Keterangan Siswa", get: s => b(s, "dailyLanguage") },

  // B. Tempat Tinggal Siswa
  { key: "dusun", label: "Dusun/Lingkungan", group: "B. Tempat Tinggal Siswa", get: s => b(s, "dusun") },
  { key: "rt", label: "RT", group: "B. Tempat Tinggal Siswa", get: s => b(s, "rt") },
  { key: "rw", label: "RW", group: "B. Tempat Tinggal Siswa", get: s => b(s, "rw") },
  { key: "desa", label: "Desa/Kelurahan", group: "B. Tempat Tinggal Siswa", get: s => b(s, "desa") },
  { key: "kecamatan", label: "Kecamatan", group: "B. Tempat Tinggal Siswa", get: s => b(s, "kecamatan") },
  { key: "kabupaten", label: "Kabupaten/Kota", group: "B. Tempat Tinggal Siswa", get: s => kabupatenName(b(s, "kabupaten")) },
  { key: "province", label: "Provinsi", group: "B. Tempat Tinggal Siswa", get: s => b(s, "province") },
  { key: "studentPhone", label: "No. HP/Tlp Siswa", group: "B. Tempat Tinggal Siswa", get: s => b(s, "studentPhone") },
  { key: "parentPhone", label: "No. HP/Tlp Orang Tua", group: "B. Tempat Tinggal Siswa", get: s => s.parentPhone ?? "" },
  { key: "livesWith", label: "Tinggal Dengan", group: "B. Tempat Tinggal Siswa", get: s => b(s, "livesWith") },
  { key: "distanceToSchool", label: "Jarak ke Sekolah", group: "B. Tempat Tinggal Siswa", get: s => b(s, "distanceToSchool") },

  // C. Kesehatan Siswa
  { key: "bloodType", label: "Golongan Darah", group: "C. Kesehatan Siswa", get: s => b(s, "bloodType") },
  { key: "height", label: "Tinggi Badan (cm)", group: "C. Kesehatan Siswa", get: s => b(s, "height") },
  { key: "weight", label: "Berat Badan (kg)", group: "C. Kesehatan Siswa", get: s => b(s, "weight") },
  { key: "diseases", label: "Penyakit yang Pernah Diderita", group: "C. Kesehatan Siswa", get: s => b(s, "diseases") },

  // D. Pendidikan Sebelumnya
  { key: "previousSchool", label: "Asal Sekolah (SMP/MTs)", group: "D. Pendidikan Sebelumnya", get: s => s.previousSchool ?? "" },
  { key: "prevSchoolAddress", label: "Alamat Asal Sekolah", group: "D. Pendidikan Sebelumnya", get: s => b(s, "prevSchoolAddress") },
  { key: "ijazahDate", label: "Tanggal Ijazah", group: "D. Pendidikan Sebelumnya", get: s => tgl(b(s, "ijazahDate")) },
  { key: "ijazahNo", label: "Nomor Ijazah", group: "D. Pendidikan Sebelumnya", get: s => b(s, "ijazahNo") },
  { key: "skhunDate", label: "Tanggal SKHUN", group: "D. Pendidikan Sebelumnya", get: s => tgl(b(s, "skhunDate")) },
  { key: "lamaBelajar", label: "Lama Belajar", group: "D. Pendidikan Sebelumnya", get: s => b(s, "lamaBelajar") },
  { key: "pindahanDari", label: "Pindahan Dari", group: "D. Pendidikan Sebelumnya", get: s => b(s, "pindahanDari") },
  { key: "alasanPindahKe", label: "Alasan Pindah ke SMK Ini", group: "D. Pendidikan Sebelumnya", get: s => b(s, "alasanPindahKe") },
  { key: "tingkatMasuk", label: "Diterima di Tingkat", group: "D. Pendidikan Sebelumnya", get: s => b(s, "tingkatMasuk") },
  { key: "rombel", label: "Rombel", group: "D. Pendidikan Sebelumnya", get: s => b(s, "rombel") },
  { key: "class", label: "Kelas Saat Ini", group: "D. Pendidikan Sebelumnya", get: s => s.class?.name ?? "" },
  { key: "bidangKeahlian", label: "Bidang Keahlian", group: "D. Pendidikan Sebelumnya", get: s => b(s, "bidangKeahlian") },
  { key: "programKeahlian", label: "Program Keahlian", group: "D. Pendidikan Sebelumnya", get: s => b(s, "programKeahlian") },
  { key: "kompetensiKeahlian", label: "Konsentrasi Keahlian", group: "D. Pendidikan Sebelumnya", get: s => b(s, "kompetensiKeahlian") },
  { key: "diterimaDate", label: "Tanggal Diterima", group: "D. Pendidikan Sebelumnya", get: s => tgl(b(s, "diterimaDate")) },
  { key: "enrollYear", label: "Tahun Masuk SMK", group: "D. Pendidikan Sebelumnya", get: s => s.enrollYear ? String(s.enrollYear) : "" },

  // E. Keterangan Ayah
  { key: "fatherName", label: "Nama Ayah Kandung", group: "E. Keterangan Ayah", get: s => b(s, "fatherName") },
  { key: "fatherNik", label: "NIK Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherNik") },
  { key: "fatherBirthPlace", label: "Tempat Lahir Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherBirthPlace") },
  { key: "fatherBirthDate", label: "Tanggal Lahir Ayah", group: "E. Keterangan Ayah", get: s => tgl(b(s, "fatherBirthDate")) },
  { key: "fatherReligion", label: "Agama Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherReligion") },
  { key: "fatherCitizenship", label: "Kewarganegaraan Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherCitizenship") },
  { key: "fatherEducation", label: "Pendidikan Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherEducation") },
  { key: "fatherJob", label: "Pekerjaan Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherJob") },
  { key: "fatherIncome", label: "Pengeluaran Bulanan Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherIncome") },
  { key: "fatherDusun", label: "Dusun Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherDusun") },
  { key: "fatherRt", label: "RT Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherRt") },
  { key: "fatherRw", label: "RW Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherRw") },
  { key: "fatherDesa", label: "Desa Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherDesa") },
  { key: "fatherKecamatan", label: "Kecamatan Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherKecamatan") },
  { key: "fatherKabupaten", label: "Kabupaten Ayah", group: "E. Keterangan Ayah", get: s => kabupatenName(b(s, "fatherKabupaten")) },
  { key: "fatherProvince", label: "Provinsi Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherProvince") },
  { key: "fatherAlive", label: "Kondisi Ayah", group: "E. Keterangan Ayah", get: s => b(s, "fatherAlive") },

  // F. Keterangan Ibu
  { key: "motherName", label: "Nama Ibu Kandung", group: "F. Keterangan Ibu", get: s => b(s, "motherName") },
  { key: "motherNik", label: "NIK Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherNik") },
  { key: "motherBirthPlace", label: "Tempat Lahir Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherBirthPlace") },
  { key: "motherBirthDate", label: "Tanggal Lahir Ibu", group: "F. Keterangan Ibu", get: s => tgl(b(s, "motherBirthDate")) },
  { key: "motherReligion", label: "Agama Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherReligion") },
  { key: "motherCitizenship", label: "Kewarganegaraan Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherCitizenship") },
  { key: "motherEducation", label: "Pendidikan Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherEducation") },
  { key: "motherJob", label: "Pekerjaan Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherJob") },
  { key: "motherIncome", label: "Pengeluaran Bulanan Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherIncome") },
  { key: "motherDusun", label: "Dusun Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherDusun") },
  { key: "motherRt", label: "RT Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherRt") },
  { key: "motherRw", label: "RW Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherRw") },
  { key: "motherDesa", label: "Desa Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherDesa") },
  { key: "motherKecamatan", label: "Kecamatan Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherKecamatan") },
  { key: "motherKabupaten", label: "Kabupaten Ibu", group: "F. Keterangan Ibu", get: s => kabupatenName(b(s, "motherKabupaten")) },
  { key: "motherProvince", label: "Provinsi Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherProvince") },
  { key: "motherAlive", label: "Kondisi Ibu", group: "F. Keterangan Ibu", get: s => b(s, "motherAlive") },

  // G. Keterangan Wali
  { key: "guardianName", label: "Nama Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianName") },
  { key: "guardianNik", label: "NIK Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianNik") },
  { key: "guardianBirthPlace", label: "Tempat Lahir Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianBirthPlace") },
  { key: "guardianBirthDate", label: "Tanggal Lahir Wali", group: "G. Keterangan Wali", get: s => tgl(b(s, "guardianBirthDate")) },
  { key: "guardianReligion", label: "Agama Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianReligion") },
  { key: "guardianCitizenship", label: "Kewarganegaraan Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianCitizenship") },
  { key: "guardianEducation", label: "Pendidikan Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianEducation") },
  { key: "guardianJob", label: "Pekerjaan Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianJob") },
  { key: "guardianIncome", label: "Pengeluaran Bulanan Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianIncome") },
  { key: "guardianDusun", label: "Dusun Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianDusun") },
  { key: "guardianRt", label: "RT Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianRt") },
  { key: "guardianRw", label: "RW Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianRw") },
  { key: "guardianDesa", label: "Desa Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianDesa") },
  { key: "guardianKecamatan", label: "Kecamatan Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianKecamatan") },
  { key: "guardianKabupaten", label: "Kabupaten Wali", group: "G. Keterangan Wali", get: s => kabupatenName(b(s, "guardianKabupaten")) },
  { key: "guardianProvince", label: "Provinsi Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianProvince") },
  { key: "guardianPhone", label: "No. HP/Tlp Wali", group: "G. Keterangan Wali", get: s => b(s, "guardianPhone") },

  // H. Kegemaran Siswa
  { key: "hobbyArt", label: "Kesenian", group: "H. Kegemaran Siswa", get: s => b(s, "hobbyArt") },
  { key: "hobbySport", label: "Olahraga", group: "H. Kegemaran Siswa", get: s => b(s, "hobbySport") },
  { key: "hobbyOrg", label: "Organisasi", group: "H. Kegemaran Siswa", get: s => b(s, "hobbyOrg") },
  { key: "hobbyOther", label: "Hobi Lainnya", group: "H. Kegemaran Siswa", get: s => b(s, "hobbyOther") },

  // I. Prestasi
  { key: "achievements", label: "Jumlah Prestasi", group: "I. Prestasi", get: s => b(s, "achievements") || "0" },

  // J. Praktik Kerja Lapangan (PKL)
  { key: "pklPlace", label: "Tempat PKL", group: "J. PKL", get: s => b(s, "pklPlace") },
  { key: "pklAddress", label: "Alamat PKL", group: "J. PKL", get: s => b(s, "pklAddress") },
  { key: "pklStartDate", label: "Tanggal Mulai PKL", group: "J. PKL", get: s => tgl(b(s, "pklStartDate")) },
  { key: "pklEndDate", label: "Tanggal Selesai PKL", group: "J. PKL", get: s => tgl(b(s, "pklEndDate")) },
  { key: "pklLatitude", label: "Lintang (LS)", group: "J. PKL", get: s => b(s, "pklLatitude") },
  { key: "pklLongitude", label: "Bujur (BT)", group: "J. PKL", get: s => b(s, "pklLongitude") },
  { key: "pklSupervisor", label: "Guru Pembimbing PKL", group: "J. PKL", get: s => b(s, "pklSupervisor") },
  { key: "pklScore", label: "Nilai PKL", group: "J. PKL", get: s => b(s, "pklScore") },

  // K. Kelulusan
  { key: "graduationDate", label: "Tanggal Lulus", group: "K. Kelulusan", get: s => tgl(b(s, "graduationDate")) },
  { key: "graduationIjazahNo", label: "Nomor Ijazah Kelulusan", group: "K. Kelulusan", get: s => b(s, "graduationIjazahNo") },
  { key: "skhunNo", label: "Nomor SKHUN", group: "K. Kelulusan", get: s => b(s, "skhunNo") },
  { key: "avgReport", label: "Rata-rata Nilai Rapor", group: "K. Kelulusan", get: s => b(s, "avgReport") },
  { key: "avgExam", label: "Rata-rata Nilai Ujian", group: "K. Kelulusan", get: s => b(s, "avgExam") },
  { key: "continueStudy", label: "Melanjutkan Ke", group: "K. Kelulusan", get: s => b(s, "continueStudy") },
  { key: "workPlan", label: "Rencana Kerja", group: "K. Kelulusan", get: s => b(s, "workPlan") },

  // L. Pindah/Keluar
  { key: "studentStatus", label: "Status Siswa", group: "L. Pindah/Keluar", get: s => s.studentStatus ?? "AKTIF" },
  { key: "pindahDate", label: "Tanggal Pindah/Keluar", group: "L. Pindah/Keluar", get: s => tgl(b(s, "pindahDate") || s.exitDate) },
  { key: "suratNo", label: "Nomor Surat", group: "L. Pindah/Keluar", get: s => b(s, "suratNo") },
  { key: "transferTo", label: "Pindah/Keluar Ke", group: "L. Pindah/Keluar", get: s => b(s, "transferTo") },
  { key: "alasanPindah", label: "Alasan Pindah/Keluar", group: "L. Pindah/Keluar", get: s => b(s, "alasanPindah") || s.studentNotes || "" },

  // M. Akun & Login
  { key: "email", label: "Email Login", group: "M. Akun & Login", get: s => s.user.email },
];
