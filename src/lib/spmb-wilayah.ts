import "server-only";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
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

export async function rapikanWilayah(kabKode: unknown, kecKode: unknown, desaKode?: unknown) {
  const kosong = { kabupatenKode: null, kabupaten: null, kecamatanKode: null, kecamatan: null, desaKode: null, desa: null } as {
    kabupatenKode: string | null; kabupaten: string | null; kecamatanKode: string | null; kecamatan: string | null; desaKode: string | null; desa: string | null };
  if (typeof kabKode !== "string" || !/^\d{2}\.\d{2}$/.test(kabKode)) return kosong;
  try {
    const kab = (await petaKabupaten()).get(kabKode);
    if (!kab) return kosong;
    const hasil = { ...kosong, kabupatenKode: kab.k, kabupaten: kab.n };
    if (typeof kecKode !== "string" || !/^\d{2}\.\d{2}\.\d{2}$/.test(kecKode) || !kecKode.startsWith(kabKode + ".")) return hasil;
    const daftar = JSON.parse(await readFile(join(DIR, "kec", `${kabKode}.json`), "utf8")) as { k: string; n: string }[];
    const kec = daftar.find(x => x.k === kecKode);
    if (!kec) return hasil;
    const denganKec = { ...hasil, kecamatanKode: kec.k, kecamatan: kec.n };
    if (typeof desaKode !== "string" || !/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(desaKode) || !desaKode.startsWith(kecKode + ".")) return denganKec;
    const desa = (JSON.parse(await readFile(join(DIR, "desa", `${kabKode}.json`), "utf8")) as { k: string; n: string }[]).find(x => x.k === desaKode);
    return desa ? { ...denganKec, desaKode: desa.k, desa: desa.n } : denganKec;
  } catch {
    return kosong;
  }
}

/** Nama provinsi dari kode kabupaten (sinkron, disinggahkan) — untuk mengisi alamat Buku Induk saat konversi. */
let singgahProv: Map<string, string> | null = null;
export function provinsiDariKabupaten(kabKode: string | null | undefined): string {
  if (!kabKode) return "";
  try {
    singgahProv ??= new Map((JSON.parse(readFileSync(join(DIR, "kabupaten.json"), "utf8")) as Kab[]).map(x => [x.k, x.p]));
    return singgahProv.get(kabKode) ?? "";
  } catch { return ""; }
}
