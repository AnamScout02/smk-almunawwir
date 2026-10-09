/** BATAS WILAYAH UNTUK PETA SEBARAN (7 Oktober 2026) — pengolah MURNI, dipakai skrip pembangun
 *  (`scripts/bangun-peta.ts`: provinsi, kabupaten, kecamatan se-Indonesia → public/data/peta) DAN server
 *  (batas desa diambil per kabupaten saat pertama dibuka, lalu disimpan — `src/lib/peta-desa.ts`).
 *
 *  Sumber: github.com/cahyadsn/wilayah_boundaries (MIT) — kode Kepmendagri 2025, sama dengan
 *  public/data/wilayah yang dipakai formulir SPMB. Baris SQL `(kode, nama, lat, lng, path)`, `path` =
 *  multipoligon JSON berurutan [lat, lng].
 *
 *  Keluaran sudah berupa jalur SVG (x = bujur, y = −lintang) yang disederhanakan Douglas–Peucker dan
 *  dibulatkan per tingkat, supaya peta se-Indonesia tetap ringan dibuka di HP. */

export type BarisBatas = { k: string; n: string; lat: number; lng: number; path: unknown };
/** Satu wilayah di peta: kode, nama, titik label [x,y], kotak [minX,minY,maxX,maxY], jalur SVG. */
export type WilayahPeta = { k: string; n: string; c: [number, number]; b: [number, number, number, number]; d: string };

export type TingkatPeta = "prov" | "kab" | "kec" | "desa";
/** Toleransi penyederhanaan (derajat) & jumlah desimal per tingkat. 0,001° ≈ 110 m. */
export const MUTU: Record<TingkatPeta, { tol: number; des: number }> = {
  prov: { tol: 0.02, des: 2 },
  kab: { tol: 0.004, des: 3 },
  kec: { tol: 0.0012, des: 4 },
  desa: { tol: 0.0003, des: 4 },
};

/** Urai berkas SQL sumber. Nama boleh berisi tanda kutip ganda-tunggal ('') atau \'. */
export function uraiSqlBatas(sql: string): BarisBatas[] {
  const hasil: BarisBatas[] = [];
  const re = /\(\s*'([\d.]+)'\s*,\s*'((?:[^'\\]|\\.|'')*)'\s*,\s*(-?[\d.]+|NULL)\s*,\s*(-?[\d.]+|NULL)\s*,\s*'(\[[^']*\])'\s*\)/g;
  for (const m of sql.matchAll(re)) {
    let path: unknown;
    try { path = JSON.parse(m[5]); } catch { continue; }
    hasil.push({ k: m[1], n: m[2].replace(/''/g, "'").replace(/\\(.)/g, "$1"), lat: Number(m[3]) || 0, lng: Number(m[4]) || 0, path });
  }
  return hasil;
}

type Titik = [number, number];

/** Kumpulkan semua cincin (daftar titik [x,y]) dari bentuk bersarang apa pun. */
function cincinDari(v: unknown, keluar: Titik[][] = []): Titik[][] {
  if (!Array.isArray(v) || !v.length) return keluar;
  if (typeof v[0] === "number") return keluar;
  if (Array.isArray(v[0]) && typeof v[0][0] === "number") {
    const r: Titik[] = [];
    for (const p of v as number[][]) if (Number.isFinite(p[0]) && Number.isFinite(p[1])) r.push([p[1], -p[0]]);
    if (r.length >= 3) keluar.push(r);
    return keluar;
  }
  for (const x of v) cincinDari(x, keluar);
  return keluar;
}

function jarakGaris(p: Titik, a: Titik, b: Titik) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = dx * dx + dy * dy;
  if (!l) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas–Peucker tanpa rekursi (cincin kecamatan bisa ribuan titik). */
function sederhanakan(r: Titik[], tol: number): Titik[] {
  if (r.length <= 4) return r;
  const simpan = new Uint8Array(r.length);
  simpan[0] = simpan[r.length - 1] = 1;
  const tumpuk: [number, number][] = [[0, r.length - 1]];
  while (tumpuk.length) {
    const [a, b] = tumpuk.pop()!;
    let maks = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = jarakGaris(r[i], r[a], r[b]);
      if (d > maks) { maks = d; idx = i; }
    }
    if (idx > 0 && maks > tol) { simpan[idx] = 1; tumpuk.push([a, idx], [idx, b]); }
  }
  return r.filter((_, i) => simpan[i]);
}

function luasCincin(r: Titik[]) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(s / 2);
}

/** Ubah satu baris sumber menjadi wilayah peta. `null` bila tidak ada bentuk yang tersisa. */
export function keWilayahPeta(b: BarisBatas, tingkat: TingkatPeta): WilayahPeta | null {
  const { tol, des } = MUTU[tingkat];
  const f = 10 ** des;
  const bulat = (x: number) => Math.round(x * f) / f;
  const semua = cincinDari(b.path);
  // Pulau sangat kecil dibuang (tidak terlihat di tingkat ini), tetapi wilayah yang SELURUHNYA
  // kecil (kota kecil, desa) tetap dipertahankan cincin terbesarnya.
  const terbesar = Math.max(0, ...semua.map(luasCincin));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const bagian: string[] = [];
  for (const r of semua) {
    const luas = luasCincin(r);
    if (luas < tol * tol * 4 && luas < terbesar) continue;
    let s = sederhanakan(r, tol).map(([x, y]) => [bulat(x), bulat(y)] as Titik);
    s = s.filter((p, i) => i === 0 || p[0] !== s[i - 1][0] || p[1] !== s[i - 1][1]);
    if (s.length < 3) s = r.length >= 3 ? [r[0], r[Math.floor(r.length / 3)], r[Math.floor((2 * r.length) / 3)]].map(([x, y]) => [bulat(x), bulat(y)] as Titik) : s;
    if (s.length < 3) continue;
    for (const [x, y] of s) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    bagian.push("M" + s.map(([x, y]) => `${x} ${y}`).join("L") + "Z");
  }
  if (!bagian.length) return null;
  const c: [number, number] = b.lng && b.lat ? [bulat(b.lng), bulat(-b.lat)] : [bulat((minX + maxX) / 2), bulat((minY + maxY) / 2)];
  return { k: b.k, n: b.n, c, b: [minX, minY, maxX, maxY], d: bagian.join("") };
}
