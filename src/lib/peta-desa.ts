import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { keWilayahPeta, uraiSqlBatas, type WilayahPeta } from "@/lib/peta-batas";

/** BATAS DESA untuk peta sebaran (7 Oktober 2026). Batas desa se-Indonesia ±1 GB, jadi TIDAK ikut image:
 *  diambil per kabupaten dari sumber yang sama dengan batas lain (cahyadsn/wilayah_boundaries, MIT) saat
 *  kabupaten itu PERTAMA kali dibuka, diolah `keWilayahPeta`, lalu disimpan di volume unggahan
 *  (`public/uploads/peta-desa`) sehingga tetap ada setelah deploy dan tidak diunduh ulang. */
const SIMPAN = join(process.cwd(), "public", "uploads", "peta-desa");
const SUMBER = "https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/main/db/kel";
const berjalan = new Map<string, Promise<WilayahPeta[]>>();

export async function batasDesa(kab: string): Promise<WilayahPeta[]> {
  if (!/^\d{2}\.\d{2}$/.test(kab)) throw new Error("KODE");
  const berkas = join(SIMPAN, `${kab}.json`);
  const ada = await readFile(berkas, "utf8").then(t => JSON.parse(t) as WilayahPeta[]).catch(() => null);
  if (ada) return ada;
  const jalan = berjalan.get(kab);
  if (jalan) return jalan;
  const p = (async () => {
    const r = await fetch(`${SUMBER}/${kab.slice(0, 2)}/wilayah_boundaries_kel_${kab}.sql`, { signal: AbortSignal.timeout(45_000) });
    if (!r.ok) throw new Error(r.status === 404 ? "TIDAK_ADA" : "UNDUH");
    const hasil = uraiSqlBatas(await r.text())
      .filter(b => b.k.startsWith(kab + "."))
      .map(b => keWilayahPeta(b, "desa"))
      .filter((w): w is WilayahPeta => !!w)
      .sort((a, b) => a.k.localeCompare(b.k));
    await mkdir(SIMPAN, { recursive: true });
    await writeFile(berkas, JSON.stringify(hasil));
    return hasil;
  })().finally(() => berjalan.delete(kab));
  berjalan.set(kab, p);
  return p;
}
