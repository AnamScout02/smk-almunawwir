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

/** Letak tiap isian pokok di formulir Buku Induk Siswa: huruf bagian (accordion) + awalan LABEL isiannya — untuk tautan langsung
 *  `…/buku-induk/siswa?edit=<id>&bagian=<huruf>&isian=<label>` yang membuka & menyorot isian itu (permintaan user 10 Okt 2026:
 *  "yang diperlukan mengisi NISN ya langsung ke NISN"). Dipakai isian PERTAMA yang kurang. Label = teks di BukuIndukSiswaModal;
 *  kalau label di sana diganti, ubah di sini juga (tautan tetap membuka bagiannya walau label tak ketemu). */
const LETAK: Record<string, [string, string]> = {
  "NISN": ["a", "NISN"], "NIK": ["a", "NIK"], "jenis kelamin": ["a", "Jenis Kelamin"], "tempat lahir": ["a", "Tempat Lahir"],
  "tanggal lahir": ["a", "Tanggal Lahir"], "agama": ["a", "Agama"], "alamat": ["b", "Provinsi|Desa|Dusun"], "HP orang tua": ["b", "No. HP/Tlp Orang Tua"],
  "asal sekolah": ["d", "Asal Sekolah|Nama Sekolah|Sekolah Asal"], "nama ayah": ["e", "Nama Ayah"], "nama ibu": ["f", "Nama Ibu"],
  "tanggal lulus": ["k", "Tanggal Lulus"], "nomor ijazah": ["k", "Nomor Ijazah Kelulusan"],
};
export const tautanPokok = (id: string, kurang: string[]) => {
  const [bagian, isian] = LETAK[kurang[0]] ?? ["a", ""];
  return `/dashboard/admin/buku-induk/siswa?edit=${id}&bagian=${bagian}${isian ? `&isian=${encodeURIComponent(isian)}` : ""}`;
};

/** Letak isian yang dimaksud tiap temuan Pemeriksa Data (kode temuan → bagian + awalan label) — baris temuan membuka
 *  formulir Buku Induk siswa itu LANGSUNG di isian yang perlu dibetulkan, bukan lembar cetaknya. Temuan baru tanpa
 *  entri di sini tetap membuka formulir siswanya (bagian A). */
const LETAK_TEMUAN: Record<string, [string, string]> = {
  "nisn-ganda": ["a", "NISN"], "tanpa-angkatan": ["d", "Tahun Angkatan"], "kelas-vs-angkatan": ["d", "Tahun Angkatan"],
  "lulus-vs-angkatan": ["k", "Tanggal Lulus"], "keluar-tanpa-tanggal": ["l", "Tanggal"], "nominatif-belum-lengkap": ["a", "NISN"],
  "ortu-lahir-janggal": ["e", "Tanggal Lahir"], "nis-pola-aneh": ["a", "NIS"], "email-tidak-sinkron": ["m", "Email"],
  "tanpa-foto": ["a", "Foto"],
};
export const tautanTemuan = (kode: string, id: string) => {
  const [bagian, isian] = LETAK_TEMUAN[kode] ?? ["a", ""];
  return `/dashboard/admin/buku-induk/siswa?edit=${id}&bagian=${bagian}${isian ? `&isian=${encodeURIComponent(isian)}` : ""}`;
};
