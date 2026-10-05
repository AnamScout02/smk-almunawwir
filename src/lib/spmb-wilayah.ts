import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Wilayah pendaftar SPMB (2 Oktober 2026, untuk peta sebaran). Kode dari browser TIDAK dipercaya:
 *  dicocokkan ke berkas resmi `public/data/wilayah` (Kepmendagri 2025), dan namanya diambil dari
 *  berkas itu — bukan dari teks kiriman pendaftar. Kode yang tidak dikenal = dikosongkan, BUKAN
 *  menolak pendaftaran (isian ini hanya untuk statistik). */
const DIR = join(process.cwd(), "public", "data", "wilayah");
type Kab = { k: string; n: string; p: string };
let singgahKab: Map<string, Kab> | null = null;

async function petaKabupaten(): Promise<Map<string, Kab>> {
  if (singgahKab) return singgahKab;
  const isi = JSON.parse(await readFile(join(DIR, "kabupaten.json"), "utf8")) as Kab[];
  singgahKab = new Map(isi.map(x => [x.k, x]));
  return singgahKab;
}

export async function rapikanWilayah(kabKode: unknown, kecKode: unknown) {
  const kosong = { kabupatenKode: null, kabupaten: null, kecamatanKode: null, kecamatan: null };
  if (typeof kabKode !== "string" || !/^\d{2}\.\d{2}$/.test(kabKode)) return kosong;
  try {
    const kab = (await petaKabupaten()).get(kabKode);
    if (!kab) return kosong;
    const hasil = { ...kosong, kabupatenKode: kab.k, kabupaten: kab.n };
    if (typeof kecKode !== "string" || !/^\d{2}\.\d{2}\.\d{2}$/.test(kecKode) || !kecKode.startsWith(kabKode + ".")) return hasil;
    const daftar = JSON.parse(await readFile(join(DIR, "kec", `${kabKode}.json`), "utf8")) as { k: string; n: string }[];
    const kec = daftar.find(x => x.k === kecKode);
    return kec ? { ...hasil, kecamatanKode: kec.k, kecamatan: kec.n } : hasil;
  } catch {
    return kosong;
  }
}
