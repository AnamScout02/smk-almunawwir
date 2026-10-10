/** Jenis berkas siswa (netral — dipakai panel klien & server). `pokok` = yang diharapkan ada di map tiap siswa; daftar
 *  "belum lengkap" di Meja Kerja hanya menghitung yang pokok. Ubah daftar ini bila sekolah mewajibkan dokumen lain. */
export const JENIS_BERKAS_SISWA = [
  { kunci: "IJAZAH_SMP", label: "Ijazah / SKL SMP/MTs", pokok: true },
  { kunci: "KK", label: "Kartu Keluarga", pokok: true },
  { kunci: "AKTA", label: "Akta kelahiran", pokok: true },
  { kunci: "KTP_ORTU", label: "KTP orang tua / wali", pokok: false },
  { kunci: "SKHUN", label: "SKHUN / transkrip nilai SMP", pokok: false },
  { kunci: "KIP", label: "KIP / KKS / PKH", pokok: false },
  { kunci: "PAS_FOTO", label: "Pas foto", pokok: false },
  { kunci: "PINDAHAN", label: "Surat pindah / rapor sekolah asal", pokok: false },
  { kunci: "LAINNYA", label: "Dokumen lain", pokok: false },
] as const;
export type JenisBerkasSiswa = (typeof JENIS_BERKAS_SISWA)[number]["kunci"];
export const labelBerkasSiswa = (k: string) => JENIS_BERKAS_SISWA.find(j => j.kunci === k)?.label ?? k;
export const BERKAS_POKOK = JENIS_BERKAS_SISWA.filter(j => j.pokok).map(j => j.kunci as string);
/** Dokumen pendaftaran SPMB yang sudah diunggah calon dihitung sebagai berkas yang ADA (tidak perlu dipindai ulang). */
export const DARI_SPMB: Record<string, "ijazahUrl" | "kkUrl" | "ktpWaliUrl" | "fotoUrl"> = { IJAZAH_SMP: "ijazahUrl", KK: "kkUrl", KTP_ORTU: "ktpWaliUrl", PAS_FOTO: "fotoUrl" };
