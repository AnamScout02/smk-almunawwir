import "server-only";
import { readFile, stat } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import sharp from "sharp";
import { getSettings } from "@/lib/site-settings";

/** IKON APLIKASI TERPASANG (PWA) — dibangkitkan dari **Logo Lambang** (`logo.emblem`, Konten Halaman →
 * Logo), bukan gambar statis. Admin mengganti logo → ikon aplikasi ikut berganti tanpa build ulang
 * (manifest memberi `?v=` versi logo, sehingga browser memperbarui ikon aplikasi yang sudah terpasang).
 *
 *   any-192/512      logo apa adanya, latar transparan → laptop/desktop menampilkan logo bundar utuh.
 *   maskable-192/512 logo diperkecil ke zona aman 80% di atas warna tepi logo itu sendiri — Android
 *                    memotong ikon jadi lingkaran/kotak tumpul tanpa memotong tulisan melingkar logo.
 *   apple-180        sama, 88%, tanpa transparansi (iOS mengisi bagian transparan dengan hitam).
 *
 * Keputusan user 14 September 2026: ikon aplikasi memakai logo bundar sekolah. Gambar di public/icons/
 * tinggal cadangan kalau logo gagal dibaca. */
export const VARIAN_IKON = {
  "any-192.png": { ukuran: 192, jenis: "any" },
  "any-512.png": { ukuran: 512, jenis: "any" },
  "maskable-192.png": { ukuran: 192, jenis: "maskable" },
  "maskable-512.png": { ukuran: 512, jenis: "maskable" },
  "apple-180.png": { ukuran: 180, jenis: "apple" },
} as const;
export type NamaIkon = keyof typeof VARIAN_IKON;

export const IKON_CADANGAN: Record<NamaIkon, string> = {
  "any-192.png": "/icons/icon-192.png",
  "any-512.png": "/icons/icon-512.png",
  "maskable-192.png": "/icons/icon-maskable-192.png",
  "maskable-512.png": "/icons/icon-maskable-512.png",
  "apple-180.png": "/icons/apple-touch-icon.png",
};

const LOGO_BAWAAN = "/images/logo-emblem.png";
const NAVY = { r: 15, g: 26, b: 69 };
const PERIKSA_ULANG_MS = 60_000;
const TRANSPARAN = { r: 0, g: 0, b: 0, alpha: 0 };

type Logo = { data: Buffer; versi: string };
let simpanan: { logo: Logo; dicek: number; hasil: Map<NamaIkon, Buffer> } | null = null;

const sidik = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

async function bacaLogo(): Promise<Logo> {
  const s = await getSettings(["logo.emblem"]);
  const akarPublic = path.join(process.cwd(), "public");
  for (const url of [s["logo.emblem"], LOGO_BAWAAN]) {
    if (!url) continue;
    try {
      if (/^https?:\/\//i.test(url)) {
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) continue;
        const data = Buffer.from(await r.arrayBuffer());
        return { data, versi: sidik(`${url}|${data.length}`) };
      }
      const rel = path.normalize(decodeURIComponent(url.split("?")[0])).replace(/^[/\\]+/, "");
      const berkas = path.join(akarPublic, rel);
      if (!berkas.startsWith(akarPublic + path.sep)) continue; // tolak ../ keluar dari public
      const st = await stat(berkas);
      return { data: await readFile(berkas), versi: sidik(`${url}|${st.size}|${st.mtimeMs}`) };
    } catch {
      // coba logo berikutnya
    }
  }
  throw new Error("Logo Lambang tidak bisa dibaca");
}

async function logoTerkini(): Promise<NonNullable<typeof simpanan>> {
  if (simpanan && Date.now() - simpanan.dicek < PERIKSA_ULANG_MS) return simpanan;
  const logo = await bacaLogo();
  if (simpanan && simpanan.logo.versi === logo.versi) {
    simpanan.dicek = Date.now();
    return simpanan;
  }
  simpanan = { logo, dicek: Date.now(), hasil: new Map() };
  return simpanan;
}

/** Warna tepi logo: dari 8 arah, jalan dari pinggir gambar ke dalam sampai piksel buram pertama, lalu ambil
 * warna sedikit di dalamnya. Logo bundar → warna cincin luarnya; logo kotak berlatar → warna latarnya. */
async function warnaTepi(data: Buffer) {
  const N = 96;
  const { data: px } = await sharp(data).resize(N, N, { fit: "contain", background: TRANSPARAN }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const ambil = (x: number, y: number) => { const i = (y * N + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  const arah = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const kelompok = new Map<string, number[][]>();
  for (const [dx, dy] of arah) {
    let x = dx > 0 ? 0 : dx < 0 ? N - 1 : N >> 1;
    let y = dy > 0 ? 0 : dy < 0 ? N - 1 : N >> 1;
    while (x >= 0 && y >= 0 && x < N && y < N && ambil(x, y)[3] < 250) { x += dx; y += dy; }
    const sx = x + dx * 3, sy = y + dy * 3;
    if (sx < 0 || sy < 0 || sx >= N || sy >= N) continue;
    const p = ambil(sx, sy);
    if (p[3] < 250) continue;
    const kunci = p.slice(0, 3).map(v => v >> 5).join(",");
    kelompok.set(kunci, [...(kelompok.get(kunci) ?? []), p]);
  }
  const terbanyak = [...kelompok.values()].sort((a, b) => b.length - a.length)[0];
  if (!terbanyak) return NAVY;
  const rata = (i: number) => Math.round(terbanyak.reduce((t, p) => t + p[i], 0) / terbanyak.length);
  return { r: rata(0), g: rata(1), b: rata(2) };
}

async function bangkitkan(data: Buffer, nama: NamaIkon) {
  const { ukuran, jenis } = VARIAN_IKON[nama];
  if (jenis === "any") {
    return sharp(data).resize(ukuran, ukuran, { fit: "contain", background: TRANSPARAN }).png().toBuffer();
  }
  const latar = await warnaTepi(data);
  const isi = Math.round(ukuran * (jenis === "apple" ? 0.88 : 0.8));
  const logo = await sharp(data).resize(isi, isi, { fit: "contain", background: TRANSPARAN }).png().toBuffer();
  const kanvas = sharp({ create: { width: ukuran, height: ukuran, channels: 4, background: { ...latar, alpha: 1 } } })
    .composite([{ input: logo, gravity: "center" }]);
  return (jenis === "apple" ? kanvas.flatten({ background: latar }) : kanvas).png().toBuffer();
}

export async function ikonAplikasi(nama: NamaIkon): Promise<{ png: Buffer; versi: string }> {
  const s = await logoTerkini();
  let png = s.hasil.get(nama);
  if (!png) {
    png = await bangkitkan(s.logo.data, nama);
    s.hasil.set(nama, png);
  }
  return { png, versi: s.logo.versi };
}

/** Versi logo untuk `?v=` di manifest — berubah begitu Logo Lambang diganti. */
export async function versiIkon() {
  return (await logoTerkini()).logo.versi;
}
