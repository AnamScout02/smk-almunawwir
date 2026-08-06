// Field yang boleh diajukan perubahan oleh siswa sendiri (approval admin/TAS diperlukan).
// Field administratif (NIS, NISN, kelas, jurusan, tahun masuk, status, dll) sengaja TIDAK termasuk —
// tetap harus diubah admin langsung lewat Buku Induk.

export const EDITABLE_TOP_FIELDS = [
  "birthPlace", "birthDate", "gender", "religion", "address",
  "parentName", "parentPhone", "parentJob", "previousSchool",
] as const;

export const EDITABLE_BUKU_FIELDS = [
  // A. Keterangan Siswa
  "fotoMasukUrl", "nik", "nickname", "citizenship",
  "childOrder", "siblingsCount", "halfSiblings", "adoptedSiblings", "orphanStatus", "dailyLanguage",
  // B. Tempat Tinggal
  "dusun", "rt", "rw", "desa", "kecamatan", "kabupaten", "province",
  "studentPhone", "livesWith", "distanceToSchool",
  // C. Kesehatan
  "bloodType", "diseases", "height", "weight",
  // D. Pendidikan Sebelumnya (bukan bagian penempatan/enrollment)
  "prevSchoolAddress", "ijazahDate", "ijazahNo", "skhunDate", "lamaBelajar", "pindahanDari", "alasanPindahKe",
  // E. Ayah
  "fatherName", "fatherNik", "fatherBirthPlace", "fatherBirthDate", "fatherReligion", "fatherCitizenship",
  "fatherEducation", "fatherJob", "fatherIncome", "fatherDusun", "fatherRt", "fatherRw",
  "fatherDesa", "fatherKecamatan", "fatherKabupaten", "fatherProvince", "fatherAlive",
  // F. Ibu
  "motherName", "motherNik", "motherBirthPlace", "motherBirthDate", "motherReligion", "motherCitizenship",
  "motherEducation", "motherJob", "motherIncome", "motherDusun", "motherRt", "motherRw",
  "motherDesa", "motherKecamatan", "motherKabupaten", "motherProvince", "motherAlive",
  // G. Wali
  "guardianName", "guardianNik", "guardianBirthPlace", "guardianBirthDate", "guardianReligion", "guardianCitizenship",
  "guardianEducation", "guardianJob", "guardianIncome", "guardianDusun", "guardianRt", "guardianRw",
  "guardianDesa", "guardianKecamatan", "guardianKabupaten", "guardianProvince", "guardianPhone",
  // H. Kegemaran
  "hobbyArt", "hobbySport", "hobbyOrg", "hobbyOther",
  // I. Prestasi (array, diperlakukan sebagai satu kesatuan)
  "achievements",
] as const;

export const FIELD_LABELS: Record<string, string> = {
  birthPlace: "Tempat Lahir", birthDate: "Tanggal Lahir", gender: "Jenis Kelamin", religion: "Agama",
  address: "Alamat", parentName: "Nama Orang Tua (ringkas)", parentPhone: "No. HP Orang Tua (ringkas)",
  parentJob: "Pekerjaan Orang Tua (ringkas)", previousSchool: "Asal Sekolah",
  fotoMasukUrl: "Foto Siswa", nik: "NIK Siswa", nickname: "Nama Panggilan", citizenship: "Kewarganegaraan",
  childOrder: "Anak Ke-", siblingsCount: "Jumlah Saudara Kandung", halfSiblings: "Jumlah Saudara Tiri",
  adoptedSiblings: "Jumlah Saudara Angkat", orphanStatus: "Yatim/Piatu", dailyLanguage: "Bahasa Sehari-hari",
  dusun: "Dusun/Lingkungan", rt: "RT", rw: "RW", desa: "Desa/Kelurahan", kecamatan: "Kecamatan",
  kabupaten: "Kabupaten/Kota", province: "Provinsi", studentPhone: "No. HP Siswa",
  livesWith: "Tinggal Dengan", distanceToSchool: "Jarak ke Sekolah",
  bloodType: "Golongan Darah", diseases: "Riwayat Penyakit", height: "Tinggi Badan", weight: "Berat Badan",
  prevSchoolAddress: "Alamat Asal Sekolah", ijazahDate: "Tanggal Ijazah", ijazahNo: "Nomor Ijazah",
  skhunDate: "Tanggal SKHUN", lamaBelajar: "Lama Belajar", pindahanDari: "Pindahan Dari", alasanPindahKe: "Alasan Pindah ke SMK Ini",
  fatherName: "Nama Ayah", fatherNik: "NIK Ayah", fatherBirthPlace: "Tempat Lahir Ayah", fatherBirthDate: "Tanggal Lahir Ayah",
  fatherReligion: "Agama Ayah", fatherCitizenship: "Kewarganegaraan Ayah", fatherEducation: "Pendidikan Ayah",
  fatherJob: "Pekerjaan Ayah", fatherIncome: "Penghasilan Ayah", fatherDusun: "Dusun Ayah", fatherRt: "RT Ayah", fatherRw: "RW Ayah",
  fatherDesa: "Desa Ayah", fatherKecamatan: "Kecamatan Ayah", fatherKabupaten: "Kabupaten Ayah", fatherProvince: "Provinsi Ayah",
  fatherAlive: "Status Ayah",
  motherName: "Nama Ibu", motherNik: "NIK Ibu", motherBirthPlace: "Tempat Lahir Ibu", motherBirthDate: "Tanggal Lahir Ibu",
  motherReligion: "Agama Ibu", motherCitizenship: "Kewarganegaraan Ibu", motherEducation: "Pendidikan Ibu",
  motherJob: "Pekerjaan Ibu", motherIncome: "Penghasilan Ibu", motherDusun: "Dusun Ibu", motherRt: "RT Ibu", motherRw: "RW Ibu",
  motherDesa: "Desa Ibu", motherKecamatan: "Kecamatan Ibu", motherKabupaten: "Kabupaten Ibu", motherProvince: "Provinsi Ibu",
  motherAlive: "Status Ibu",
  guardianName: "Nama Wali", guardianNik: "NIK Wali", guardianBirthPlace: "Tempat Lahir Wali", guardianBirthDate: "Tanggal Lahir Wali",
  guardianReligion: "Agama Wali", guardianCitizenship: "Kewarganegaraan Wali", guardianEducation: "Pendidikan Wali",
  guardianJob: "Pekerjaan Wali", guardianIncome: "Penghasilan Wali", guardianDusun: "Dusun Wali", guardianRt: "RT Wali", guardianRw: "RW Wali",
  guardianDesa: "Desa Wali", guardianKecamatan: "Kecamatan Wali", guardianKabupaten: "Kabupaten Wali", guardianProvince: "Provinsi Wali",
  guardianPhone: "No. HP Wali",
  hobbyArt: "Kesenian", hobbySport: "Olahraga", hobbyOrg: "Organisasi", hobbyOther: "Kegemaran Lainnya",
  achievements: "Prestasi/Penghargaan",
};

export interface ChangeEntry { old: unknown; new: unknown; label: string }
export type ChangeMap = Record<string, ChangeEntry>;
