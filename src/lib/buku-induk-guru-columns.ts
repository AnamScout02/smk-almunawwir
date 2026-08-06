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

export interface ColDef { key: string; label: string; group: string; get: (t: TeacherRow) => string }

export const GURU_COLUMNS: ColDef[] = [
  { key: "nip", label: "NIP", group: "Identitas", get: t => t.nip },
  { key: "nik", label: "NIK", group: "Identitas", get: t => b(t, "nik") },
  { key: "nuptk", label: "NUPTK", group: "Identitas", get: t => b(t, "nuptk") },
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
];
