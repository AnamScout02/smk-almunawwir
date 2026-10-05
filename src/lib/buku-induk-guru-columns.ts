/** Definisi kolom tabel lengkap Buku Induk Guru — dipakai bersama oleh halaman tabel on-screen
 * dan endpoint export Excel, supaya urutan & label kolom selalu sinkron di kedua tempat. */

export interface TeacherRow {
  nip: string; subject: string; phone?: string | null;
  birthPlace?: string | null; birthDate?: Date | string | null;
  gender?: string | null; religion?: string | null; address?: string | null;
  education?: string | null; position?: string | null; startDate?: Date | string | null;
  teacherStatus?: string | null; shortCode?: string | null;
  bukuIndukData?: Record<string, unknown> | null;
  user: { name: string };
  homeroomOf: { name: string }[];
}

const b = (t: TeacherRow, key: string): string => {
  const v = t.bukuIndukData?.[key];
  return v === undefined || v === null || v === "" ? "" : String(v);
};
const tgl = (v?: string | Date | null): string => {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};
/** Nama kabupaten/kota tanpa kata "Kabupaten"/"Kota" di depan. */
const kabupatenName = (v: string) => v.replace(/^(Kabupaten|Kota)\s+/i, "");

export interface ColDef {
  key: string; label: string; group: string; get: (t: TeacherRow) => string;
  /** Diisi HANYA untuk kolom yang tersimpan di `bukuIndukData` dan boleh diketik di formulir
   *  Buku Induk Guru. Formulir dibangun dari daftar ini juga (`GURU_ISIAN`), supaya kunci di
   *  tabel, ekspor Excel, dan isian tidak pernah berbeda. */
  isian?: { tipe?: "text" | "date" | "textarea"; opsi?: string[] };
}

export const GURU_COLUMNS: ColDef[] = [
  { key: "nip", label: "NIP", group: "Identitas", get: t => t.nip },
  { key: "nik", label: "NIK", group: "Identitas", get: t => b(t, "nik") },
  // Diberi isian 2 Oktober 2026 (temuan user: "di guru apa ada tempat untuk menambahkan NIP/NUPTK").
  // Sebelumnya NUPTK hanya bisa DILIHAT — tidak ada satu pun layar yang bisa mengisinya, dan 0 dari
  // 32 guru terisi. NUPTK dipakai memasangkan data guru dengan Dapodik (CLAUDE.md #38).
  { key: "nuptk", label: "NUPTK", group: "Identitas", get: t => b(t, "nuptk"), isian: {} },
  { key: "nama", label: "Nama Lengkap", group: "Identitas", get: t => t.user.name },
  { key: "gender", label: "JK", group: "Identitas", get: t => t.gender === "L" ? "Laki-laki" : t.gender === "P" ? "Perempuan" : "" },
  { key: "birthPlace", label: "Tempat Lahir", group: "Identitas", get: t => t.birthPlace ?? "" },
  { key: "birthDate", label: "Tanggal Lahir", group: "Identitas", get: t => tgl(t.birthDate) },
  { key: "religion", label: "Agama", group: "Identitas", get: t => t.religion ?? "" },
  { key: "maritalStatus", label: "Status Kawin", group: "Identitas", get: t => b(t, "maritalStatus") },
  { key: "spouseName", label: "Nama Pasangan", group: "Identitas", get: t => b(t, "spouseName") },

  { key: "address", label: "Alamat", group: "Alamat", get: t => t.address ?? "" },
  { key: "desa", label: "Desa", group: "Alamat", get: t => b(t, "desa") },
  { key: "kecamatan", label: "Kecamatan", group: "Alamat", get: t => b(t, "kecamatan") },
  { key: "kabupaten", label: "Kabupaten", group: "Alamat", get: t => kabupatenName(b(t, "kabupaten")) },
  { key: "phone", label: "No. HP", group: "Alamat", get: t => t.phone ?? "" },

  { key: "education", label: "Pendidikan Terakhir", group: "Kepegawaian", get: t => t.education ?? "" },
  { key: "position", label: "Jabatan", group: "Kepegawaian", get: t => t.position ?? "" },
  { key: "workStatus", label: "Status Kepegawaian", group: "Kepegawaian", get: t => b(t, "workStatus") },
  { key: "workUnit", label: "Unit Kerja", group: "Kepegawaian", get: t => b(t, "workUnit") },
  { key: "subject", label: "Mata Pelajaran", group: "Kepegawaian", get: t => t.subject },
  { key: "startDate", label: "Tanggal Mulai Tugas", group: "Kepegawaian", get: t => tgl(t.startDate) },
  { key: "certNo", label: "No. Sertifikasi", group: "Kepegawaian", get: t => b(t, "certNo") },
  { key: "certStatus", label: "Status Sertifikasi", group: "Kepegawaian", get: t => b(t, "certStatus") },

  { key: "shortCode", label: "Kode Guru", group: "Sekolah", get: t => t.shortCode ?? "" },
  { key: "homeroomOf", label: "Wali Kelas", group: "Sekolah", get: t => t.homeroomOf.map(c => c.name).join(", ") },
  { key: "teacherStatus", label: "Status", group: "Sekolah", get: t => t.teacherStatus ?? "AKTIF" },

  /* ── Isian dari berkas rujukan Buku Induk sekolah (dikirim user 30 September 2026) ──
     Lembar "AMBILDATA GURU" punya 126 kolom; yang di bawah ini belum ada di situs. Semuanya
     disimpan di `bukuIndukData` (JSON) sehingga TIDAK perlu perubahan schema. Kuncinya dipakai
     bersama oleh tabel lengkap, ekspor Excel, DAN formulir Buku Induk Guru — jangan menulis
     nama kunci baru di salah satu tempat saja. */
  { key: "kewarganegaraan", label: "Kewarganegaraan", group: "Identitas", get: t => b(t, "kewarganegaraan"), isian: { opsi: ["Indonesia", "Asing"] } },
  { key: "rt", label: "RT", group: "Alamat", get: t => b(t, "rt"), isian: {} },
  { key: "rw", label: "RW", group: "Alamat", get: t => b(t, "rw"), isian: {} },
  { key: "dusun", label: "Dusun", group: "Alamat", get: t => b(t, "dusun"), isian: {} },

  { key: "jarakSekolah", label: "Jarak ke Sekolah", group: "Tempat Tinggal", get: t => b(t, "jarakSekolah"), isian: {} },
  { key: "tinggalDengan", label: "Tempat Tinggal", group: "Tempat Tinggal", get: t => b(t, "tinggalDengan"), isian: {} },
  { key: "statusRumah", label: "Status Tempat Tinggal", group: "Tempat Tinggal", get: t => b(t, "statusRumah"), isian: {} },

  { key: "golDarah", label: "Golongan Darah", group: "Kesehatan", get: t => b(t, "golDarah"), isian: { opsi: ["A", "B", "AB", "O"] } },
  { key: "penyakit", label: "Penyakit Pernah Diderita", group: "Kesehatan", get: t => b(t, "penyakit"), isian: { tipe: "textarea" } },
  { key: "tinggiBadan", label: "Tinggi Badan (cm)", group: "Kesehatan", get: t => b(t, "tinggiBadan"), isian: {} },
  { key: "beratBadan", label: "Berat Badan (kg)", group: "Kesehatan", get: t => b(t, "beratBadan"), isian: {} },

  { key: "sdNama", label: "SD/MI", group: "Riwayat Pendidikan", get: t => b(t, "sdNama"), isian: {} },
  { key: "sdLulus", label: "Tahun Lulus SD/MI", group: "Riwayat Pendidikan", get: t => b(t, "sdLulus"), isian: {} },
  { key: "smpNama", label: "SMP/MTs", group: "Riwayat Pendidikan", get: t => b(t, "smpNama"), isian: {} },
  { key: "smpLulus", label: "Tahun Lulus SMP/MTs", group: "Riwayat Pendidikan", get: t => b(t, "smpLulus"), isian: {} },
  { key: "smaNama", label: "SMA/MA/SMK", group: "Riwayat Pendidikan", get: t => b(t, "smaNama"), isian: {} },
  { key: "smaJurusan", label: "Jurusan SMA/SMK", group: "Riwayat Pendidikan", get: t => b(t, "smaJurusan"), isian: {} },
  { key: "smaLulus", label: "Tahun Lulus SMA/SMK", group: "Riwayat Pendidikan", get: t => b(t, "smaLulus"), isian: {} },
  { key: "s1Nama", label: "Perguruan Tinggi S1", group: "Riwayat Pendidikan", get: t => b(t, "s1Nama"), isian: {} },
  { key: "s1Prodi", label: "Program S1", group: "Riwayat Pendidikan", get: t => b(t, "s1Prodi"), isian: {} },
  { key: "s1Lulus", label: "Tahun Lulus S1", group: "Riwayat Pendidikan", get: t => b(t, "s1Lulus"), isian: {} },
  { key: "s2Nama", label: "Perguruan Tinggi S2", group: "Riwayat Pendidikan", get: t => b(t, "s2Nama"), isian: {} },
  { key: "s2Prodi", label: "Program S2", group: "Riwayat Pendidikan", get: t => b(t, "s2Prodi"), isian: {} },
  { key: "s2Lulus", label: "Tahun Lulus S2", group: "Riwayat Pendidikan", get: t => b(t, "s2Lulus"), isian: {} },
  { key: "s3Nama", label: "Perguruan Tinggi S3", group: "Riwayat Pendidikan", get: t => b(t, "s3Nama"), isian: {} },
  { key: "s3Prodi", label: "Program S3", group: "Riwayat Pendidikan", get: t => b(t, "s3Prodi"), isian: {} },
  { key: "s3Lulus", label: "Tahun Lulus S3", group: "Riwayat Pendidikan", get: t => b(t, "s3Lulus"), isian: {} },

  { key: "statusSebagai", label: "Status sebagai Suami/Istri", group: "Perkawinan", get: t => b(t, "statusSebagai"), isian: {} },
  { key: "spouseBirthPlace", label: "Tempat Lahir Pasangan", group: "Perkawinan", get: t => b(t, "spouseBirthPlace"), isian: {} },
  { key: "spouseBirthDate", label: "Tanggal Lahir Pasangan", group: "Perkawinan", get: t => b(t, "spouseBirthDate"), isian: { tipe: "date" } },
  { key: "spouseWarga", label: "Kewarganegaraan Pasangan", group: "Perkawinan", get: t => b(t, "spouseWarga"), isian: { opsi: ["Indonesia", "Asing"] } },
  { key: "spouseKet", label: "Keterangan Pasangan", group: "Perkawinan", get: t => b(t, "spouseKet"), isian: { tipe: "textarea" } },

  { key: "ibuNama", label: "Nama Ibu Kandung", group: "Ibu Kandung", get: t => b(t, "ibuNama"), isian: {} },
  { key: "ibuNik", label: "NIK Ibu", group: "Ibu Kandung", get: t => b(t, "ibuNik"), isian: {} },
  { key: "ibuBirthPlace", label: "Tempat Lahir Ibu", group: "Ibu Kandung", get: t => b(t, "ibuBirthPlace"), isian: {} },
  { key: "ibuBirthDate", label: "Tanggal Lahir Ibu", group: "Ibu Kandung", get: t => b(t, "ibuBirthDate"), isian: { tipe: "date" } },
  { key: "ibuAgama", label: "Agama Ibu", group: "Ibu Kandung", get: t => b(t, "ibuAgama"), isian: {} },
  { key: "ibuWarga", label: "Kewarganegaraan Ibu", group: "Ibu Kandung", get: t => b(t, "ibuWarga"), isian: { opsi: ["Indonesia", "Asing"] } },
  { key: "ibuPendidikan", label: "Pendidikan Ibu", group: "Ibu Kandung", get: t => b(t, "ibuPendidikan"), isian: {} },
  { key: "ibuPekerjaan", label: "Pekerjaan Ibu", group: "Ibu Kandung", get: t => b(t, "ibuPekerjaan"), isian: {} },
  { key: "ibuAlamat", label: "Alamat Ibu", group: "Ibu Kandung", get: t => b(t, "ibuAlamat"), isian: { tipe: "textarea" } },
  { key: "ibuHidup", label: "Ibu Masih Hidup", group: "Ibu Kandung", get: t => b(t, "ibuHidup"), isian: { opsi: ["Masih Hidup", "Sudah Meninggal"] } },

  { key: "anak1Nama", label: "Anak ke-1 — Nama", group: "Anak", get: t => b(t, "anak1Nama"), isian: {} },
  { key: "anak1Nik", label: "Anak ke-1 — NIK", group: "Anak", get: t => b(t, "anak1Nik"), isian: {} },
  { key: "anak1Tempat", label: "Anak ke-1 — Tempat Lahir", group: "Anak", get: t => b(t, "anak1Tempat"), isian: {} },
  { key: "anak1Tanggal", label: "Anak ke-1 — Tanggal Lahir", group: "Anak", get: t => b(t, "anak1Tanggal"), isian: { tipe: "date" } },
  { key: "anak1Ortu", label: "Anak ke-1 — Nama Ayah/Ibu", group: "Anak", get: t => b(t, "anak1Ortu"), isian: {} },
  { key: "anak2Nama", label: "Anak ke-2 — Nama", group: "Anak", get: t => b(t, "anak2Nama"), isian: {} },
  { key: "anak2Nik", label: "Anak ke-2 — NIK", group: "Anak", get: t => b(t, "anak2Nik"), isian: {} },
  { key: "anak2Tempat", label: "Anak ke-2 — Tempat Lahir", group: "Anak", get: t => b(t, "anak2Tempat"), isian: {} },
  { key: "anak2Tanggal", label: "Anak ke-2 — Tanggal Lahir", group: "Anak", get: t => b(t, "anak2Tanggal"), isian: { tipe: "date" } },
  { key: "anak2Ortu", label: "Anak ke-2 — Nama Ayah/Ibu", group: "Anak", get: t => b(t, "anak2Ortu"), isian: {} },
  { key: "anak3Nama", label: "Anak ke-3 — Nama", group: "Anak", get: t => b(t, "anak3Nama"), isian: {} },
  { key: "anak3Nik", label: "Anak ke-3 — NIK", group: "Anak", get: t => b(t, "anak3Nik"), isian: {} },
  { key: "anak3Tempat", label: "Anak ke-3 — Tempat Lahir", group: "Anak", get: t => b(t, "anak3Tempat"), isian: {} },
  { key: "anak3Tanggal", label: "Anak ke-3 — Tanggal Lahir", group: "Anak", get: t => b(t, "anak3Tanggal"), isian: { tipe: "date" } },
  { key: "anak3Ortu", label: "Anak ke-3 — Nama Ayah/Ibu", group: "Anak", get: t => b(t, "anak3Ortu"), isian: {} },
  { key: "anak4Nama", label: "Anak ke-4 — Nama", group: "Anak", get: t => b(t, "anak4Nama"), isian: {} },
  { key: "anak4Nik", label: "Anak ke-4 — NIK", group: "Anak", get: t => b(t, "anak4Nik"), isian: {} },
  { key: "anak4Tempat", label: "Anak ke-4 — Tempat Lahir", group: "Anak", get: t => b(t, "anak4Tempat"), isian: {} },
  { key: "anak4Tanggal", label: "Anak ke-4 — Tanggal Lahir", group: "Anak", get: t => b(t, "anak4Tanggal"), isian: { tipe: "date" } },
  { key: "anak4Ortu", label: "Anak ke-4 — Nama Ayah/Ibu", group: "Anak", get: t => b(t, "anak4Ortu"), isian: {} },
  { key: "anak5Nama", label: "Anak ke-5 — Nama", group: "Anak", get: t => b(t, "anak5Nama"), isian: {} },
  { key: "anak5Nik", label: "Anak ke-5 — NIK", group: "Anak", get: t => b(t, "anak5Nik"), isian: {} },
  { key: "anak5Tempat", label: "Anak ke-5 — Tempat Lahir", group: "Anak", get: t => b(t, "anak5Tempat"), isian: {} },
  { key: "anak5Tanggal", label: "Anak ke-5 — Tanggal Lahir", group: "Anak", get: t => b(t, "anak5Tanggal"), isian: { tipe: "date" } },
  { key: "anak5Ortu", label: "Anak ke-5 — Nama Ayah/Ibu", group: "Anak", get: t => b(t, "anak5Ortu"), isian: {} },

  { key: "hrg1Tahun", label: "Penghargaan 1 — Tahun", group: "Penghargaan", get: t => b(t, "hrg1Tahun"), isian: {} },
  { key: "hrg1Kriteria", label: "Penghargaan 1 — Kriteria", group: "Penghargaan", get: t => b(t, "hrg1Kriteria"), isian: {} },
  { key: "hrg1Oleh", label: "Penghargaan 1 — Diberikan Oleh", group: "Penghargaan", get: t => b(t, "hrg1Oleh"), isian: {} },
  { key: "hrg2Tahun", label: "Penghargaan 2 — Tahun", group: "Penghargaan", get: t => b(t, "hrg2Tahun"), isian: {} },
  { key: "hrg2Kriteria", label: "Penghargaan 2 — Kriteria", group: "Penghargaan", get: t => b(t, "hrg2Kriteria"), isian: {} },
  { key: "hrg2Oleh", label: "Penghargaan 2 — Diberikan Oleh", group: "Penghargaan", get: t => b(t, "hrg2Oleh"), isian: {} },
  { key: "hrg3Tahun", label: "Penghargaan 3 — Tahun", group: "Penghargaan", get: t => b(t, "hrg3Tahun"), isian: {} },
  { key: "hrg3Kriteria", label: "Penghargaan 3 — Kriteria", group: "Penghargaan", get: t => b(t, "hrg3Kriteria"), isian: {} },
  { key: "hrg3Oleh", label: "Penghargaan 3 — Diberikan Oleh", group: "Penghargaan", get: t => b(t, "hrg3Oleh"), isian: {} },
  { key: "hrg4Tahun", label: "Penghargaan 4 — Tahun", group: "Penghargaan", get: t => b(t, "hrg4Tahun"), isian: {} },
  { key: "hrg4Kriteria", label: "Penghargaan 4 — Kriteria", group: "Penghargaan", get: t => b(t, "hrg4Kriteria"), isian: {} },
  { key: "hrg4Oleh", label: "Penghargaan 4 — Diberikan Oleh", group: "Penghargaan", get: t => b(t, "hrg4Oleh"), isian: {} },
  { key: "hrg5Tahun", label: "Penghargaan 5 — Tahun", group: "Penghargaan", get: t => b(t, "hrg5Tahun"), isian: {} },
  { key: "hrg5Kriteria", label: "Penghargaan 5 — Kriteria", group: "Penghargaan", get: t => b(t, "hrg5Kriteria"), isian: {} },
  { key: "hrg5Oleh", label: "Penghargaan 5 — Diberikan Oleh", group: "Penghargaan", get: t => b(t, "hrg5Oleh"), isian: {} },

  { key: "pindahTanggal", label: "Tanggal Pindah", group: "Pindah / Keluar", get: t => b(t, "pindahTanggal"), isian: { tipe: "date" } },
  { key: "pindahKe", label: "Pindah Ke", group: "Pindah / Keluar", get: t => b(t, "pindahKe"), isian: {} },
  { key: "pindahAlasan", label: "Alasan Pindah", group: "Pindah / Keluar", get: t => b(t, "pindahAlasan"), isian: { tipe: "textarea" } },
];
