/**
 * CODEMOD — pasang `lemparBilaPengalihan(e)` di baris pertama setiap `catch` route API
 * yang memakai penjaga auth (CLAUDE.md #72b, diperluas dari 35 berkas CBT ke seluruh app).
 *
 * Kenapa: `verifyRole`/`verifyTasAccess` menolak dengan REDIRECT Next.js yang dilempar sebagai
 * galat ber-`digest` "NEXT_REDIRECT". Kalau tertelan `catch` umum, pengguna yang sesinya habis
 * menerima **500** alih-alih dialihkan ke halaman masuk — log penuh kejadian palsu dan masalah
 * asli tersamar.
 *
 * Aman karena `lemparBilaPengalihan` HANYA melempar ulang galat pengalihan/not-found; galat lain
 * dibiarkan jatuh ke penanganan yang sudah ada.
 *
 * Bekerja PER BARIS, bukan regex multibaris — dua bentuk `catch` dipakai di repo ini:
 *     } catch (e) {            ← badan di baris berikutnya
 *     } catch { return ...; }  ← badan sebaris
 * Regex multibaris melewatkan bentuk kedua (154 berkas pada percobaan pertama).
 *
 * Pakai: node scripts/sapu-pengalihan.mjs [--tulis]   (tanpa --tulis = pratinjau saja)
 */
import fs from "node:fs";
import path from "node:path";

const TULIS = process.argv.includes("--tulis");
const IMPOR = 'import { lemparBilaPengalihan } from "@/lib/galat-rute";';
const PENJAGA = /verifyRole|verifyTasAccess|verifyBukuIndukFullAccess|verifyDapodikAccess|verifySession/;

const berkas = [];
(function telusur(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) telusur(p);
    else if (/\/route\.ts$/.test(p)) berkas.push(p);
  }
})("src/app");

let ubah = 0, sisip = 0;
const lewat = [];

for (const p of berkas) {
  const asli = fs.readFileSync(p, "utf8");
  if (!PENJAGA.test(asli)) continue;
  if (/lemparBilaPengalihan/.test(asli)) continue;      // sudah dipasang

  const baris = asli.split("\n");
  const hasil = [];
  let n = 0;

  for (let b of baris) {
    // `catch {` tanpa pengikat → beri pengikat supaya galatnya bisa diperiksa. Shadowing aman:
    // badan catch sebelumnya memang tidak bisa menyentuh variabel galat sama sekali.
    b = b.replace(/\bcatch\s*\{/g, "catch (e) {");

    const m = b.match(/\bcatch \((\w+)\) \{/);
    if (!m) { hasil.push(b); continue; }
    const nama = m[1];
    const iBuka = b.indexOf(m[0]) + m[0].length;
    const sesudah = b.slice(iBuka);

    if (sesudah.trim() === "") {
      // Badan di baris berikutnya → sisipkan baris sendiri, indentasi + 2 spasi.
      const indent = (b.match(/^[ \t]*/) || [""])[0];
      hasil.push(b, `${indent}  lemparBilaPengalihan(${nama});`);
    } else {
      // Badan sebaris → sisipkan tepat setelah `{`.
      hasil.push(b.slice(0, iBuka) + ` lemparBilaPengalihan(${nama});` + sesudah);
    }
    n++;
  }

  if (n === 0) { lewat.push(`${p} — tidak ada catch`); continue; }

  let s = hasil.join("\n");
  if (!s.includes(IMPOR)) {
    const imp = [...s.matchAll(/^import .*;$/gm)];
    if (imp.length === 0) { lewat.push(`${p} — tidak ada baris import`); continue; }
    const akhir = imp[imp.length - 1].index + imp[imp.length - 1][0].length;
    s = s.slice(0, akhir) + "\n" + IMPOR + s.slice(akhir);
  }

  if (s !== asli) { ubah++; sisip += n; if (TULIS) fs.writeFileSync(p, s); }
}

console.log(`${TULIS ? "DITULIS" : "PRATINJAU"}: ${ubah} berkas · ${sisip} sisipan`);
if (lewat.length) {
  console.log(`\nDILEWATI (${lewat.length}) — perlu tangan:`);
  for (const l of lewat.slice(0, 20)) console.log("   " + l);
  if (lewat.length > 20) console.log(`   … ${lewat.length - 20} lagi`);
}
