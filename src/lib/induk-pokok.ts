/** Isian POKOK Buku Induk Siswa — yang dipakai surat, rapor, Dapodik, dan kartu. Bukan seluruh ±150 kolom: mewajibkan
 *  golongan darah atau jumlah saudara tiri akan menandai semua siswa dan daftarnya jadi tidak berguna.
 *  SATU sumber untuk Meja Kerja TU dan Profil Siswa (netral, tanpa akses DB). */
type SiswaPokok = { nisn?: string | null; gender?: string | null; birthPlace?: string | null; birthDate?: Date | string | null;
  religion?: string | null; address?: string | null; parentPhone?: string | null; previousSchool?: string | null; bukuIndukData?: unknown };
const isi = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function pokokKurang(x: SiswaPokok): string[] {
  const d = (x.bukuIndukData && typeof x.bukuIndukData === "object" ? x.bukuIndukData : {}) as Record<string, unknown>;
  return [!isi(x.nisn) && "NISN", !isi(d.nik) && "NIK", !isi(x.gender) && "jenis kelamin", !isi(x.birthPlace) && "tempat lahir",
    !x.birthDate && "tanggal lahir", !isi(x.religion) && "agama", !(isi(x.address) || (isi(d.desa) && isi(d.kecamatan))) && "alamat",
    !isi(d.fatherName) && "nama ayah", !isi(d.motherName) && "nama ibu", !isi(x.parentPhone) && "HP orang tua",
    !isi(x.previousSchool) && "asal sekolah"].filter((v): v is string => !!v);
}
export const JUMLAH_POKOK = 11;
