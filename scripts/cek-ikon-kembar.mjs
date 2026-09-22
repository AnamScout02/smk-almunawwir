#!/usr/bin/env node
// Pemeriksa pola ikon lucide yang RAWAN di berkas SERVER (tanpa "use client") — CLAUDE.md gotcha #35.
//
// Di lucide-react 1.x komponen dasar `Icon` bertanda "use client", jadi ikon di halaman server adalah rujukan klien. Dua pola
// terbukti bisa membuat build produksi 500 "Element type is invalid … got: object" (padahal `next dev` normal & tsc lolos):
//   1. PROP  — elemen ikon dioper sebagai prop ke komponen (mis. `<StatTile icon={<Users />}>`). Untuk komponen klien pakai
//              NAMA ikon: `StatTile ikon="akun"`, `TautanIkon`/`TautanCepat`/`KartuTautan` (src/components/shared/IkonNama.tsx).
//              15 Sep 2026: dashboard Admin 500 karena pola ini (bisect di build lokal).
//   2. KEMBAR — ikon yang sama dipakai lebih dari sekali dalam satu berkas (14 Sep 2026, beranda Pusat Perpustakaan).
// Catatan: `icon={<X />}` ke komponen SERVER (PageHeader, Panel) aman; pemeriksa ini tetap menandainya kecuali prop `icon`
// milik PageHeader dan `ikon` milik Panel/PanelKosong/DaftarPengumuman, supaya daftar tetap pendek.
//
// Pakai:  node scripts/cek-ikon-kembar.mjs [berkas-atau-folder ...]   (bawaan: src/app)
// Keluar dengan kode 1 bila ada temuan — jalankan pada berkas yang diubah sebelum `docker compose build`.
import fs from "fs";
import path from "path";

const sasaran = process.argv.slice(2).length ? process.argv.slice(2) : ["src/app"];
const berkas = [];
function jelajah(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const n of fs.readdirSync(p)) if (n !== "node_modules" && !n.startsWith(".")) jelajah(path.join(p, n)); }
  else if (/\.tsx$/.test(p)) berkas.push(p);
}
sasaran.forEach(jelajah);

// Prop ikon milik komponen SERVER yang memang merender ikon di markup server — aman. Kunci = nama komponen, isi = nama prop.
const PROP_SERVER_AMAN = { PageHeader: ["icon"], Panel: ["ikon"], PanelKosong: ["ikon"], DaftarPengumuman: ["ikon"] };
/** Komponen pemilik prop pada baris ke-i: tag pembuka `<Nama` terdekat di baris itu atau hingga 6 baris di atasnya. */
function pemilikProp(baris, i, posisi) {
  for (let k = i; k >= Math.max(0, i - 6); k--) {
    const teks = k === i ? baris[k].slice(0, posisi) : baris[k];
    const tag = [...teks.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].pop();
    if (tag) return tag[1];
  }
  return null;
}

let temuan = 0;
for (const f of berkas) {
  const isi = fs.readFileSync(f, "utf8");
  if (/^\s*["']use client["']/m.test(isi.slice(0, 200))) continue;
  const impor = [...isi.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)]
    .flatMap(m => m[1].split(",").map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
  if (!impor.length) continue;

  const kembar = impor
    .map(nama => [nama, (isi.match(new RegExp(`<${nama}[\\s/>]`, "g")) ?? []).length])
    .filter(([, n]) => n > 1)
    .map(([n, c]) => `${n}×${c}`);

  const prop = [];
  const baris = isi.split("\n");
  baris.forEach((teks, i) => {
    for (const nama of impor) {
      for (const m of teks.matchAll(new RegExp(`(\\w+)=\\{<${nama}[\\s/>]`, "g"))) {
        const pemilik = pemilikProp(baris, i, m.index);
        if (pemilik && PROP_SERVER_AMAN[pemilik]?.includes(m[1])) continue;
        prop.push(`${nama} → ${pemilik ?? "?"}.${m[1]} (baris ${i + 1})`);
      }
    }
  });

  if (kembar.length || prop.length) {
    temuan++;
    const bagian = [];
    if (prop.length) bagian.push(`dioper sebagai prop: ${prop.join(", ")}`);
    if (kembar.length) bagian.push(`kembar: ${kembar.join(", ")}`);
    console.log(`${f}: ${bagian.join(" · ")}`);
  }
}
console.log(temuan ? `\n${temuan} berkas server memakai pola ikon lucide yang rawan (CLAUDE.md #35).` : "Tidak ada pola ikon lucide rawan di berkas server.");
process.exit(temuan ? 1 : 0);
