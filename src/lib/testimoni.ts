/** Testimoni beranda (`beranda.testimoni`, JSON) — satu pembaca untuk beranda & penyunting Konten Halaman.
 *  Netral (bukan server-only). Baris rusak dibuang, bukan membuat beranda gagal. */
export type Testimoni = { nama: string; peran: string; isi: string; foto: string };

export function bacaTestimoni(mentah: string | undefined): Testimoni[] {
  try {
    const j = JSON.parse(mentah || "[]");
    if (!Array.isArray(j)) return [];
    return j.map(x => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      const t = (k: string, maks: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, maks) : "");
      return { nama: t("nama", 80), peran: t("peran", 120), isi: t("isi", 600), foto: t("foto", 300) };
    }).filter(x => x.nama && x.isi);
  } catch { return []; }
}
