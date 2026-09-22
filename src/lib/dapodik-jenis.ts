/** Bentuk data pratinjau Sinkron Dapodik — dipakai bersama `src/lib/dapodik-sinkron.ts` (server), API ekspor, dan
 * `DapodikManager` (klien). ARAH DATA: data TU di situs adalah ACUAN, Dapodik yang disamakan (keputusan user
 * 14 Sep 2026). Nilai tampilan (tanggal, jenis kelamin) sudah diformat di server. */

/** Dasar pasangan yang hanya bersandar pada nama — ditandai lebih lemah di tampilan. */
export const NAMA_SAJA = "Nama saja";
export const NAMA_TANPA_GELAR = "Nama (tanpa gelar)";
/** Dasar pasangan yang dipilih operator sendiri (tabel DapodikPasangan) — bisa dilepas lagi. */
export const DICOCOKKAN_MANUAL = "Dicocokkan manual";

/** Calon pasangan untuk tombol Cocokkan: data TU yang belum berpasangan, atau data Dapodik yang belum berpasangan. */
export interface CalonPasangan { id: string; nama: string; ket: string }

/** Nilai Dapodik yang berbeda dari data TU — operator menyamakannya ke nilai TU. */
export interface TemuanBeda { key: string; label: string; tu: string; dapodik: string }
/** Isian yang ada di data TU tetapi masih kosong di Dapodik — operator melengkapinya di Dapodik. */
export interface IsianKurang { key: string; label: string; nilai: string }

/**
 * sesuai         — berpasangan & sama
 * perbaiki       — berpasangan, Dapodik berbeda dari TU atau belum lengkap
 * keluarDiTu     — berpasangan, tetapi di data TU sudah lulus/keluar/pindah
 * belumDiDapodik — aktif di data TU, tidak ditemukan di Dapodik
 * tidakAdaDiTu   — ada di Dapodik, tidak ditemukan di data TU
 */
export type StatusSinkron = "sesuai" | "perbaiki" | "keluarDiTu" | "belumDiDapodik" | "tidakAdaDiTu";

export interface BarisSinkron {
  kunci: string;
  status: StatusSinkron;
  /** Id data TU (Student/Teacher) bila baris ini berasal dari data TU. */
  tuId: string | null;
  /** peserta_didik_id / ptk_id Dapodik bila baris ini ada di Dapodik. */
  dapodikId: string | null;
  /** Kolom yang memasangkan data TU & Dapodik (NISN, NIK, …); null bila tidak berpasangan. */
  dasar: string | null;
  /** Nama menurut data TU (menurut Dapodik bila tidak ada di TU). */
  nama: string;
  /** Nomor untuk mencari orangnya di aplikasi Dapodik (NISN/NIS/NUPTK) — bukan NIK. */
  identitas: string | null;
  /** Kelas/status (siswa) atau jabatan (guru) di data TU. */
  tu: string | null;
  /** Rombel (siswa) atau jenis & status kepegawaian (GTK) di Dapodik. */
  dapodik: string | null;
  aktifDiTu: boolean | null;
  beda: TemuanBeda[];
  kurangDiDapodik: IsianKurang[];
  /** Kolom yang di data TU sendiri masih kosong — dilengkapi TU dari berkasnya, BUKAN disalin dari Dapodik. */
  kurangDiTu: string[];
  /** Yang perlu dilakukan operator di Dapodik; null bila sudah sesuai. */
  tindakan: string | null;
}

export interface RingkasanSinkron {
  dapodik: number; tuAktif: number; berpasangan: number; sesuai: number; perbaiki: number;
  keluarDiTu: number; belumDiDapodik: number; tidakAdaDiTu: number; tuBelumLengkap: number;
}

export interface BagianSinkron {
  ringkasan: RingkasanSinkron; baris: BarisSinkron[];
  /** Untuk Cocokkan manual: data TU (semua status) & data Dapodik yang belum punya pasangan. */
  calonTu: CalonPasangan[]; calonDapodik: CalonPasangan[];
}

/** Kelas di data TU (acuan): siswa aktifnya tercatat di rombel Dapodik mana. */
export interface KelasTuSinkron { id: string; nama: string; siswaAktif: number; sebaran: { label: string; jumlah: number }[] }

/** Rombel di Dapodik: anggotanya menurut data TU ada di kelas mana / berstatus apa. */
export interface RombelSinkron {
  id: string; nama: string; tingkat: string; jurusan: string; wali: string; anggota: number;
  sebaran: { label: string; jumlah: number }[];
}

export interface PratinjauDapodik {
  semester: string;
  tahunTu: string | null;
  /** Semester Dapodik bukan tahun ajaran aktif TU — tingkat kelas tidak dibandingkan. */
  semesterBeda: boolean;
  diambil: string;
  siswa: BagianSinkron;
  gtk: BagianSinkron;
  rombel: { kelasTu: KelasTuSinkron[]; daftar: RombelSinkron[] };
}

export const LABEL_STATUS_SINKRON: Record<StatusSinkron, string> = {
  perbaiki: "Perlu diperbaiki di Dapodik",
  belumDiDapodik: "Belum ada di Dapodik",
  tidakAdaDiTu: "Tidak ada di data TU",
  keluarDiTu: "Sudah lulus/keluar di TU",
  sesuai: "Sesuai",
};
