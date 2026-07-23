/** Mapping Bidang Keahlian & Program Keahlian per kode jurusan — tiap jurusan di sekolah ini
 * hanya punya 1 Konsentrasi Keahlian, jadi begitu jurusan/kompetensi keahlian dipilih, Bidang
 * Keahlian & Program Keahlian bisa otomatis diturunkan (dipakai di form Buku Induk & import Excel).
 * Sumber daftar nilai: prisma/seed-master-data.ts (kategori bidang_keahlian/program_keahlian/kompetensi_keahlian).
 */
export const KEAHLIAN_MAP: Record<string, { bidang: string; program: string; kompetensi: string }> = {
  TKJ: { bidang: "Teknologi Informasi dan Komunikasi", program: "Teknologi Komputer dan Informatika", kompetensi: "Teknik Komputer dan Jaringan" },
  AK: { bidang: "Bisnis dan Manajemen", program: "Akuntansi dan Keuangan", kompetensi: "Akuntansi dan Keuangan Lembaga" },
  ATU: { bidang: "Agribisnis dan Agroteknologi", program: "Agribisnis Ternak", kompetensi: "Agribisnis Ternak Unggas" },
  DKV: { bidang: "Seni dan Industri Kreatif", program: "Seni Rupa", kompetensi: "Desain Komunikasi Visual" },
  DPIB: { bidang: "Teknologi Konstruksi dan Bangunan", program: "Desain Pemodelan dan Informasi Bangunan", kompetensi: "Desain Pemodelan dan Informasi Bangunan" },
};

export function keahlianForKompetensi(kompetensi: string) {
  return Object.values(KEAHLIAN_MAP).find(k => k.kompetensi === kompetensi);
}
