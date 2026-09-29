/**
 * AUDIT SISTEM — kesalahan & ketidaksesuaian yang TIDAK tertangkap pemeriksa lain
 * (permintaan user 29 September 2026: "audit semua kesalahan dan ketidaksesuaian
 * sistem front maupun back").
 *
 * Pelengkap, bukan pengganti:
 *   cek-keseragaman.mjs    → tampilan & tata letak
 *   cek-ikon-kembar.mjs    → ikon lucide di halaman server
 *   cek-tombol-kembali.mjs → tombol Kembali
 *
 * INGAT (CLAUDE.md #87): audit mentah selalu kelebihan hitung ±2×. Angka di bawah
 * adalah KANDIDAT untuk diperiksa, bukan daftar bug. Buka berkasnya sebelum percaya.
 *
 * Pakai: node scripts/audit-sistem.mjs [--rinci]
 */
import fs from "node:fs";
import path from "node:path";

const RINCI = process.argv.includes("--rinci");
const BERKAS = [];
(function telusur(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) telusur(p);
    else if (/\.tsx?$/.test(p)) BERKAS.push(p);
  }
})("src");

const temuan = [];
const catat = (kategori, berkas, ket) => temuan.push({ kategori, berkas, ket });

/** Rute yang memang tanpa login: papan TV, verifikasi QR publik, API publik. */
const RUTE_PUBLIK = /\/api\/(public|layar|verify|aset|hadir|banners|upload)\b|\/api\/ujian\/aplikasi\//;

for (const p of BERKAS) {
  const s = fs.readFileSync(p, "utf8");
  const route = /\/route\.ts$/.test(p);
  const page = /\/page\.tsx$/.test(p);
  const klien = /"use client"/.test(s);
  const pakaiPrisma = /from "@\/lib\/prisma"/.test(s);
  const adaPenjaga = /verifyRole|verify[A-Z]\w*Access|verifySession|assert[A-Z]\w+|boleh[A-Z]\w+\(/.test(s);

  // ───────── BACKEND ─────────
  if (route) {
    // Penolakan verifyRole berupa redirect tertelan catch → 500 palsu (CLAUDE.md #72b)
    if (/verifyRole|verifyTasAccess|verifyBukuIndukFullAccess|verifyDapodikAccess/.test(s)
      && /\bcatch\s*(\([^)]*\))?\s*\{/.test(s)
      && !/lemparBilaPengalihan/.test(s)) {
      catat("pengalihan-tertelan", p, "catch tanpa lemparBilaPengalihan → penolakan auth jadi 500");
    }
    // Query Prisma tanpa penjaga apa pun
    if (pakaiPrisma && !adaPenjaga && !RUTE_PUBLIK.test(p)) {
      catat("tanpa-penjaga", p, "query Prisma tanpa verifyRole/penjaga jabatan");
    }
    // Route publik polos wajib force-dynamic (CLAUDE.md #1)
    if (pakaiPrisma && !/export const dynamic/.test(s) && !adaPenjaga && !/cookies\(/.test(s)) {
      catat("tanpa-force-dynamic", p, "route publik query Prisma tanpa force-dynamic");
    }
    // route.ts hanya boleh mengekspor handler & konfigurasi (CLAUDE.md #26)
    const SAH = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
      "dynamic", "revalidate", "runtime", "maxDuration", "fetchCache", "preferredRegion", "dynamicParams"];
    for (const m of s.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) {
      if (!SAH.includes(m[1])) {
        catat("ekspor-terlarang", p, `export ${m[1]} → "is not a valid Route export field", next build GAGAL`);
      }
    }
  }

  // Server component memakai Prisma tanpa force-dynamic (CLAUDE.md #1)
  if (page && !klien && pakaiPrisma && !/export const dynamic/.test(s)) {
    catat("tanpa-force-dynamic", p, "server component query Prisma tanpa force-dynamic");
  }

  // ───────── FRONTEND ─────────
  if (klien) {
    /* Spinner macet selamanya: "sedang memuat" disimpulkan dari `data === null`, sehingga
       fetch yang GAGAL (meski galatnya ditangkap) tidak pernah keluar dari keadaan memuat.
       Varian gotcha #12 — ditemukan nyata di PkbGuruManager 29 Sep 2026. */
    const mSpinner = s.match(/!\s*(\w+)\s*\?\s*\(?\s*<div[^>]*>\s*<Loader2/);
    if (mSpinner) {
      const negara = mSpinner[1];                       // state yang menentukan "sedang memuat"
      const setter = `set${negara[0].toUpperCase()}${negara.slice(1)}`;
      /* Yang benar-benar berbahaya BUKAN "tidak ada .catch", melainkan jalur GAGAL yang tidak
         pernah menyentuh state itu — entah `.catch(() => {})` kosong, atau pola
         `.then(r => r.ok ? r.json() : null).then(d => d && setData(d))`. Tiga berkas yang sempat
         ditandai versi longgar ternyata sudah aman karena `.catch(() => setX(cadangan))`. */
      const catchKosong = new RegExp(`\\.catch\\(\\s*\\(\\)\\s*=>\\s*\\{\\s*\\}\\s*\\)`).test(s);
      const jagaNull = new RegExp(`r\\.ok\\s*\\?[^;]*:\\s*null`).test(s)
        && new RegExp(`\\bd\\s*&&\\s*${setter}\\(`).test(s);
      const catchMengisi = new RegExp(`\\.catch\\([^)]*${setter}\\(`).test(s);
      const jalurGagalLain = new RegExp(`setGalat|setError|\\.finally\\([^)]*${setter}\\(`).test(s);
      if ((catchKosong || jagaNull) && !catchMengisi && !jalurGagalLain) {
        catat("spinner-macet", p, `gagal muat tidak pernah menyentuh "${negara}" → berputar selamanya`);
      }
    }
    // fetch berantai .then tanpa .catch (CLAUDE.md #12)
    for (const m of s.matchAll(/fetch\((?:(?!fetch\()[\s\S]){0,500}?;/g)) {
      const f = m[0];
      if (/\.then\(/.test(f) && !/\.catch\(/.test(f) && !/\bawait\b/.test(f)) {
        catat("fetch-tanpa-catch", p, f.replace(/\s+/g, " ").slice(0, 80));
      }
    }
    // Clipboard API langsung (CLAUDE.md #28) — gagal diam-diam di HTTP
    if (/navigator\.clipboard/.test(s) && !/salin-teks/.test(s)) {
      catat("clipboard-langsung", p, "navigator.clipboard → gagal diam-diam di HTTP, pakai salinTeks()");
    }
    // ID acak di komponen SSR (CLAUDE.md #15)
    if (/(Math\.random\(\)|crypto\.randomUUID\(\))[\s\S]{0,60}\b(id|Id)\b/.test(s) && !/useId\(/.test(s)) {
      catat("id-acak-ssr", p, "ID dibuat Math.random/randomUUID di komponen SSR → pakai useId()");
    }
  }
}

const kel = {};
for (const t of temuan) (kel[t.kategori] ??= []).push(t);
const urut = Object.entries(kel).sort((a, b) => b[1].length - a[1].length);

console.log("═══ AUDIT SISTEM (kandidat, bukan daftar bug) ═══");
for (const [k, v] of urut) {
  console.log(`\n▌ ${k} — ${v.length}`);
  const tampil = RINCI ? v : v.slice(0, 10);
  for (const t of tampil) console.log(`   ${t.berkas}\n     ${t.ket}`);
  if (!RINCI && v.length > tampil.length) console.log(`   … ${v.length - tampil.length} lagi (pakai --rinci)`);
}
console.log(`\nTOTAL KANDIDAT: ${temuan.length} di ${new Set(temuan.map(t => t.berkas)).size} berkas`);
