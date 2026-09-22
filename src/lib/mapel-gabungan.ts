/** MAPEL GABUNGAN (22 September 2026) — keputusan user: "nilai DPK 1, 2, 3 itu jadi satu nilai baik di rapor maupun DKN,
 * begitupun KK". Di Penugasan Mengajar tiap bagian tetap mapel sendiri (guru berbeda, Form Nilai Rapor masing-masing), tetapi
 * rapor, leger, dan DKN memakai SATU mapel. Nama & kode gabungan mengikuti lembar MATA PELAJARAN makro rapor sekolah
 * ("Konsentrasi Keahlian", kode KK). Cara menggabung nilai: `gabungForm` (src/lib/rapor-form.ts). Murni — klien & server. */
export interface GrupMapel { nama: string; singkatan: string; pola: RegExp }

export const GRUP_MAPEL: GrupMapel[] = [
  { nama: "Dasar-Dasar Program Keahlian", singkatan: "DPK", pola: /^dasar[\s-]+(dasar[\s-]+)?program\s+keahlian\b/i },
  { nama: "Konsentrasi Keahlian", singkatan: "KK", pola: /^konsentrasi\s+keahlian\b/i },
];

/** Grup sebuah mapel ("Konsentrasi Keahlian 2 (ASJ)" → Konsentrasi Keahlian), atau null bila mapel berdiri sendiri. */
export const grupMapel = (nama: string): GrupMapel | null => GRUP_MAPEL.find(g => g.pola.test(nama.trim())) ?? null;
/** Nama yang tampil di rapor/leger/DKN: nama grup untuk bagian DPK/KK, selain itu nama mapel itu sendiri. */
export const namaGabungan = (nama: string) => grupMapel(nama)?.nama ?? nama;
/** Apakah `nama` adalah NAMA GRUP (kolom gabungan), bukan bagiannya. */
export const adalahNamaGrup = (nama: string) => GRUP_MAPEL.some(g => g.nama === nama);
