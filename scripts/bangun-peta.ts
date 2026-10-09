/** Membangun data peta sebaran se-Indonesia (7 Oktober 2026).
 *
 *    npx tsx scripts/bangun-peta.ts <folder-unduhan>
 *
 *  <folder-unduhan> berisi:
 *    prov/*.sql, kab/<prov>.sql, kec/<prov>.sql  ← github.com/cahyadsn/wilayah_boundaries/db
 *    wilayah.sql, wilayah_penduduk.sql, wilayah_luas.sql ← github.com/cahyadsn/wilayah/db (cabang master)
 *
 *  Menulis:
 *    public/data/peta/prov.json        provinsi + penduduk + luas
 *    public/data/peta/kab/<prov>.json  kabupaten/kota + penduduk + luas
 *    public/data/peta/kec/<kab>.json   kecamatan
 *    public/data/wilayah/desa/<kab>.json  daftar desa/kelurahan [{k,n}] untuk isian formulir
 *  Batas DESA tidak dibangun di sini (±1 GB se-Indonesia) — diambil server per kabupaten (peta-desa.ts). */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { keWilayahPeta, uraiSqlBatas, type TingkatPeta, type WilayahPeta } from "../src/lib/peta-batas";

const SUMBER = process.argv[2];
if (!SUMBER) { console.error("Pakai: npx tsx scripts/bangun-peta.ts <folder-unduhan>"); process.exit(1); }
const PETA = join(process.cwd(), "public", "data", "peta");
const DESA = join(process.cwd(), "public", "data", "wilayah", "desa");

const baca = (f: string) => readFileSync(join(SUMBER, f), "utf8");
function tulis(f: string, isi: unknown) { writeFileSync(f, JSON.stringify(isi)); }

// Penduduk (laki-laki, perempuan, jumlah) & luas km² — tingkat provinsi & kabupaten.
const penduduk = new Map<string, number>();
for (const m of baca("wilayah_penduduk.sql").matchAll(/\('([\d.]+)','(?:[^'\\]|\\.|'')*','?(\d+)'?,'?(\d+)'?,'?(\d+)'?\)/g)) penduduk.set(m[1], Number(m[4]));
const luas = new Map<string, number>();
for (const m of baca("wilayah_luas.sql").matchAll(/\('([\d.]+)','(?:[^'\\]|\\.|'')*',([\d.]+)\)/g)) luas.set(m[1], Number(m[2]));

function olah(sql: string, tingkat: TingkatPeta, tambah = false) {
  const keluar: (WilayahPeta & { pd?: number; l?: number })[] = [];
  for (const b of uraiSqlBatas(sql)) {
    const w = keWilayahPeta(b, tingkat);
    if (!w) continue;
    keluar.push(tambah ? { ...w, pd: penduduk.get(b.k), l: luas.get(b.k) } : w);
  }
  return keluar.sort((a, b) => a.k.localeCompare(b.k));
}

rmSync(PETA, { recursive: true, force: true });
mkdirSync(join(PETA, "kab"), { recursive: true });
mkdirSync(join(PETA, "kec"), { recursive: true });

const prov = readdirSync(join(SUMBER, "prov")).flatMap(f => olah(baca(join("prov", f)), "prov", true));
tulis(join(PETA, "prov.json"), prov);
let nKab = 0, nKec = 0;
for (const p of prov) {
  const kab = olah(baca(join("kab", `${p.k}.sql`)), "kab", true);
  tulis(join(PETA, "kab", `${p.k}.json`), kab); nKab += kab.length;
  const kec = olah(baca(join("kec", `${p.k}.sql`)), "kec");
  const perKab = new Map<string, WilayahPeta[]>();
  for (const w of kec) { const kk = w.k.slice(0, 5); perKab.set(kk, [...(perKab.get(kk) ?? []), w]); }
  for (const [kk, isi] of perKab) { tulis(join(PETA, "kec", `${kk}.json`), isi); nKec += isi.length; }
}

// Daftar desa/kelurahan (kode 13 karakter) per kabupaten.
rmSync(DESA, { recursive: true, force: true });
mkdirSync(DESA, { recursive: true });
const desa = new Map<string, { k: string; n: string }[]>();
for (const m of baca("wilayah.sql").matchAll(/\('(\d{2}\.\d{2}\.\d{2}\.\d{4})','((?:[^'\\]|\\.|'')*)'\)/g)) {
  const kk = m[1].slice(0, 5);
  desa.set(kk, [...(desa.get(kk) ?? []), { k: m[1], n: m[2].replace(/''/g, "'").replace(/\\(.)/g, "$1") }]);
}
let nDesa = 0;
for (const [kk, isi] of desa) { tulis(join(DESA, `${kk}.json`), isi.sort((a, b) => a.n.localeCompare(b.n, "id"))); nDesa += isi.length; }

console.log(`provinsi ${prov.length} · kabupaten ${nKab} · kecamatan ${nKec} · daftar desa ${nDesa} (${desa.size} kabupaten)`);
