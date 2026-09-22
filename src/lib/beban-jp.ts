/** EKUIVALENSI TUGAS TAMBAHAN ke jam tatap muka (acuan Permendikbud 15/2018) untuk rekap syarat 24 JP/minggu (17 Sep 2026).
 * Diambil yang TERBESAR bila guru memegang beberapa tugas tambahan; wali kelas & pembina ekstrakurikuler ditambahkan.
 * Sesuaikan angka di sini bila sekolah memakai aturan lain. */
export const SYARAT_JP = 24;

const UTAMA: [RegExp, number][] = [
  [/^Kepala Sekolah$/, 24],
  [/^Wakil Kepala /, 12],
  [/^Kepala Kompetensi Keahlian /, 12],
  [/^Kepala Konsentrasi Keahlian$/, 12],
  [/^Kepala Laboratorium$/, 12],
  [/^Koordinator Perpustakaan$/, 12],
  [/^Kepala UKS$/, 2],
];
const TAMBAHAN: [RegExp, number][] = [
  [/^Pembina OSIS$/, 2],
  [/^Pembina Pramuka$/, 2],
  [/^Koordinator Ekstrakurikuler$/, 2],
  [/^Koordinator BKK$/, 2],
];
export const EKUIVALENSI_WALI_KELAS = 2;

export function ekuivalensiJabatan(jabatan: string[], waliKelas: boolean): { jp: number; rincian: string[] } {
  let utama = 0, namaUtama = "";
  for (const j of jabatan) for (const [p, n] of UTAMA) if (p.test(j) && n > utama) { utama = n; namaUtama = j; }
  const rincian = utama ? [`${namaUtama} ${utama} JP`] : [];
  let jp = utama;
  for (const j of jabatan) for (const [p, n] of TAMBAHAN) if (p.test(j)) { jp += n; rincian.push(`${j} ${n} JP`); }
  if (waliKelas) { jp += EKUIVALENSI_WALI_KELAS; rincian.push(`Wali kelas ${EKUIVALENSI_WALI_KELAS} JP`); }
  return { jp, rincian };
}
