/** Nama `view-transition-name` untuk elemen yang "terbang" antarhalaman (PramuatTransisi). Nama harus
 *  custom-ident CSS yang sah dan UNIK per halaman — dibentuk dari kode/slug yang dirapikan. */
const rapi = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
export const transisiJurusan = (kode: string) => `jurusan-${rapi(kode)}`;
export const transisiBerita = (slug: string) => `berita-${rapi(slug)}`;
