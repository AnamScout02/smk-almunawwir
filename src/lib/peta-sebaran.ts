import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

/** PETA SEBARAN (7 Oktober 2026) — hitungan per kode wilayah untuk SEMUA tingkat sekaligus:
 *  provinsi "35", kabupaten "35.10", kecamatan "35.10.05", desa "35.10.05.2001". Satu peta {kode: jumlah}
 *  dipakai layar untuk tingkat mana pun yang sedang dibuka.
 *
 *  - PENDAFTAR: kode resmi dari formulir (sudah dicocokkan server saat mendaftar, spmb-wilayah.ts).
 *    Yang ditolak tidak dihitung (sama dengan sebaranWilayah — sebaran untuk menilai daerah promosi).
 *  - SISWA AKTIF: Buku Induk menyimpan TEKS ("Banyuwangi", "Singojuruh", "Kemiri"), jadi dicocokkan ke kode
 *    resmi lewat nama. Nama kabupaten kembar (Kab. vs Kota Malang) diputuskan dari provinsi lalu dari
 *    kecamatannya; yang tetap ragu TIDAK ditebak — dihitung "belum terpetakan". */

export type Sebaran = { jumlah: Record<string, number>; total: number; tanpaWilayah: number };
const DIR = join(process.cwd(), "public", "data", "wilayah");

const rapi = (s: string) => s.toLowerCase()
  .replace(/^(kabupaten|kab\.?|kota|kecamatan|kec\.?|desa|kelurahan|kel\.?|provinsi|prov\.?)\s+/g, "")
  .replace(/[^a-z0-9]/g, "");

type Kode = { k: string; n: string };
let singgah: { kab: (Kode & { p: string })[]; kec: Map<string, Kode[]>; desa: Map<string, Kode[]> } | null = null;
async function daftar() {
  singgah ??= { kab: JSON.parse(await readFile(join(DIR, "kabupaten.json"), "utf8")), kec: new Map(), desa: new Map() };
  return singgah;
}
async function kecDari(kab: string) {
  const s = await daftar();
  if (!s.kec.has(kab)) s.kec.set(kab, await readFile(join(DIR, "kec", `${kab}.json`), "utf8").then(JSON.parse).catch(() => []));
  return s.kec.get(kab)!;
}
async function desaDari(kab: string) {
  const s = await daftar();
  if (!s.desa.has(kab)) s.desa.set(kab, await readFile(join(DIR, "desa", `${kab}.json`), "utf8").then(JSON.parse).catch(() => []));
  return s.desa.get(kab)!;
}

/** Cocokkan nama ke satu entri; salah ketik 1 huruf ditoleransi bila hasilnya tunggal. */
function cocokNama<T extends Kode>(nama: string, calon: T[]): T | null {
  const r = rapi(nama);
  if (!r) return null;
  const persis = calon.filter(c => rapi(c.n) === r);
  if (persis.length === 1) return persis[0];
  if (persis.length > 1) return null;
  if (r.length < 5) return null;
  const mirip = calon.filter(c => { const x = rapi(c.n); return Math.abs(x.length - r.length) <= 1 && beda1(x, r); });
  return mirip.length === 1 ? mirip[0] : null;
}
function beda1(a: string, b: string) {
  if (a === b) return true;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Satu alamat teks → kode terdalam yang bisa dipastikan ("" bila kabupaten pun tidak pasti). */
async function kodeDariAlamat(prov: string, kab: string, kec: string, desa: string): Promise<string> {
  if (!kab.trim()) return "";
  const s = await daftar();
  const r = rapi(kab);
  let calon = s.kab.filter(k => rapi(k.n) === r);
  if (!calon.length) { const m = cocokNama(kab, s.kab); calon = m ? [m] : []; }
  if (calon.length > 1 && prov.trim()) {
    const sp = calon.filter(k => rapi(k.p) === rapi(prov));
    if (sp.length) calon = sp;
  }
  if (calon.length > 1 && /^kota\b/i.test(kab.trim())) calon = calon.filter(k => /^Kota\b/.test(k.n));
  if (calon.length > 1 && kec.trim()) {
    const ada = [];
    for (const k of calon) if (cocokNama(kec, await kecDari(k.k))) ada.push(k);
    if (ada.length) calon = ada;
  }
  if (calon.length > 1) { const kb = calon.filter(k => /^Kabupaten\b/.test(k.n)); if (kb.length === 1) calon = kb; }
  if (calon.length !== 1) return "";
  const kb = calon[0];
  const kc = kec.trim() ? cocokNama(kec, await kecDari(kb.k)) : null;
  if (!kc) return kb.k;
  const ds = desa.trim() ? cocokNama(desa, (await desaDari(kb.k)).filter(d => d.k.startsWith(kc.k + "."))) : null;
  return ds ? ds.k : kc.k;
}

function tambahBerjenjang(jumlah: Record<string, number>, kode: string) {
  const b = kode.split(".");
  for (let i = 1; i <= b.length; i++) { const k = b.slice(0, i).join("."); jumlah[k] = (jumlah[k] ?? 0) + 1; }
}

export async function sebaranPetaPendaftar(): Promise<Sebaran> {
  const baris = await prisma.admission.findMany({
    where: { status: { notIn: ["DITOLAK", "REJECTED"] } },
    select: { kabupatenKode: true, kecamatanKode: true, desaKode: true },
  }).catch(() => []);
  const jumlah: Record<string, number> = {};
  let tanpa = 0;
  for (const a of baris) {
    const kode = a.desaKode || a.kecamatanKode || a.kabupatenKode;
    if (kode) tambahBerjenjang(jumlah, kode); else tanpa++;
  }
  return { jumlah, total: baris.length, tanpaWilayah: tanpa };
}

// Alamat teks → kode, disinggahkan per gabungan alamat (banyak siswa satu desa = satu pencocokan).
const memoAlamat = new Map<string, Promise<string>>();
export function kodeBukuInduk(d: Record<string, unknown>) {
  const t = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const kunci = [t("province"), t("kabupaten"), t("kecamatan"), t("desa")].join("|");
  if (!memoAlamat.has(kunci)) memoAlamat.set(kunci, kodeDariAlamat(t("province"), t("kabupaten"), t("kecamatan"), t("desa")).catch(() => ""));
  return memoAlamat.get(kunci)!;
}

async function hitungBukuInduk(baris: { bukuIndukData: unknown }[]): Promise<Sebaran> {
  const jumlah: Record<string, number> = {};
  let tanpa = 0;
  for (const s of baris) {
    const kode = await kodeBukuInduk((s.bukuIndukData ?? {}) as Record<string, unknown>);
    if (kode) tambahBerjenjang(jumlah, kode); else tanpa++;
  }
  return { jumlah, total: baris.length, tanpaWilayah: tanpa };
}

let singgahSiswa: { waktu: number; isi: Sebaran } | null = null;
export async function sebaranPetaSiswa(): Promise<Sebaran> {
  if (singgahSiswa && Date.now() - singgahSiswa.waktu < 10 * 60_000) return singgahSiswa.isi;
  const siswa = await prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { bukuIndukData: true } }).catch(() => []);
  const isi = await hitungBukuInduk(siswa);
  singgahSiswa = { waktu: Date.now(), isi };
  return isi;
}

/** Nama wilayah dari kodenya (kabupaten 5 karakter, kecamatan 8) — untuk tabel analisis & laporan cetak. */
export async function namaWilayah(kode: string): Promise<string> {
  const s = await daftar();
  if (kode.length <= 5) return s.kab.find(k => k.k === kode)?.n ?? kode;
  return (await kecDari(kode.slice(0, 5))).find(k => k.k === kode.slice(0, 8))?.n ?? kode;
}

/** ALUMNI (8 Oktober 2026, permintaan user "peta sebaran kita perkaya data alumni"): siswa berstatus LULUS, alamat
 *  dari Buku Induk (sama dengan siswa aktif), dikelompokkan per TAHUN LULUS dari isian `graduationDate` (YYYY-MM-DD).
 *  Alumni tanpa tanggal lulus hanya ikut "semua angkatan".
 *  `baris` = [kode wilayah, tahun lulus, status tracer] per alumni TANPA identitas — layar menghitung ulang darinya saat
 *  saringan status tracer (bekerja/kuliah/…) dipakai, sehingga saringan angkatan & status bisa digabung. Status "" =
 *  belum mengisi tracer. `tracer` = angka keterserapan (hanya dari yang SUDAH mengisi — bukan dari seluruh alumni). */
export type RingkasTracer = { alumni: number; mengisi: number; BEKERJA: number; KULIAH: number; WIRAUSAHA: number; BELUM_BEKERJA: number; LAINNYA: number };
export type SebaranAlumni = { semua: Sebaran; perTahun: Record<string, Sebaran>; baris: [string, string, string][]; tracer: RingkasTracer };
let singgahAlumni: { waktu: number; isi: SebaranAlumni } | null = null;
export function lupakanSebaranAlumni() { singgahAlumni = null; }
export async function sebaranPetaAlumni(): Promise<SebaranAlumni> {
  if (singgahAlumni && Date.now() - singgahAlumni.waktu < 10 * 60_000) return singgahAlumni.isi;
  const alumni = await prisma.student.findMany({
    where: { studentStatus: "LULUS" }, select: { bukuIndukData: true, alumniTracer: { select: { status: true } } },
  }).catch(() => []);
  const perTahunBaris = new Map<string, typeof alumni>();
  const baris: [string, string, string][] = [];
  const tracer: RingkasTracer = { alumni: alumni.length, mengisi: 0, BEKERJA: 0, KULIAH: 0, WIRAUSAHA: 0, BELUM_BEKERJA: 0, LAINNYA: 0 };
  for (const a of alumni) {
    const d = (a.bukuIndukData ?? {}) as Record<string, unknown>;
    const th = typeof d.graduationDate === "string" ? d.graduationDate.match(/^(\d{4})-/)?.[1] : undefined;
    if (th) perTahunBaris.set(th, [...(perTahunBaris.get(th) ?? []), a]);
    const st = a.alumniTracer?.status ?? "";
    if (st) { tracer.mengisi++; if (st === "BEKERJA" || st === "KULIAH" || st === "WIRAUSAHA" || st === "BELUM_BEKERJA") tracer[st]++; else tracer.LAINNYA++; }
    baris.push([await kodeBukuInduk(d), th ?? "", st]);
  }
  const perTahun: Record<string, Sebaran> = {};
  for (const [th, b] of [...perTahunBaris].sort((x, y) => y[0].localeCompare(x[0]))) perTahun[th] = await hitungBukuInduk(b);
  const isi = { semua: await hitungBukuInduk(alumni), perTahun, baris, tracer };
  singgahAlumni = { waktu: Date.now(), isi };
  return isi;
}
