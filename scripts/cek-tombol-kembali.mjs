/** CEK TOMBOL "KEMBALI" (24 September 2026, permintaan user: "cek halaman yang tidak punya tombol kembali, buat sama semua").
 *
 * Aturan yang diperiksa: halaman yang TIDAK ada di menu sidebar/portal WAJIB punya jalan pulang sendiri
 * (`<BarisKembali>` / `<TombolKembali>` dari src/components/shared/TombolKembali.tsx). Halaman yang ADA di menu
 * tidak perlu — menunya sendiri sudah jadi jalan pulang, dan tombol Kembali di sana justru ambigu tujuannya.
 *
 * Pakai: node scripts/cek-tombol-kembali.mjs        (keluar dengan kode 1 bila ada yang kurang)
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const SUMBER_MENU = [
  "src/components/admin/AdminSidebar.tsx", "src/components/admin/TasSidebar.tsx",
  "src/components/teacher/TeacherSidebar.tsx", "src/components/student/StudentSidebar.tsx",
  "src/components/parent/ParentSidebar.tsx", "src/components/bendahara/BendaharaSidebar.tsx",
  "src/lib/menu-portal.ts", "src/lib/menu-konteks.ts", "src/components/shared/MenuPortal.tsx",
];
const menu = new Set();
for (const f of SUMBER_MENU) {
  if (!existsSync(f)) continue;
  // semua literal rute, termasuk href bersyarat (isWakasek ? "/a" : "/b")
  for (const m of readFileSync(f, "utf8").matchAll(/"(\/[a-z0-9\-/[\]]+)"/g)) menu.add(m[1]);
}

const AKAR = "src/app";
const halaman = [];
(function sapu(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) sapu(p);
    else if (n === "page.tsx") halaman.push(p);
  }
})(AKAR);
const rute = p => "/" + p.slice(AKAR.length + 1, -"/page.tsx".length)
  .split("/").filter(s => !(s.startsWith("(") && s.endsWith(")"))).join("/");

function isiDenganImpor(p, dalam = 2) {
  let s = readFileSync(p, "utf8");
  if (dalam === 0) return s;
  for (const m of s.matchAll(/from "(@\/[^"]+)"/g)) {
    const dasar = "src/" + m[1].slice(2);
    for (const ext of [".tsx", ".ts"]) if (existsSync(dasar + ext)) { s += "\n" + isiDenganImpor(dasar + ext, dalam - 1); break; }
  }
  return s;
}

const kurang = [];
for (const p of halaman) {
  const r = rute(p);
  if (menu.has(r) || r.endsWith("/menu")) continue;
  if (!/^\/(dashboard|pusat-ujian|pusat-perpustakaan|perpustakaan)\//.test(r)) continue;
  if (r.split("/").filter(Boolean).length < 3) continue;
  const s = isiDenganImpor(p);
  if (/redirect\(/.test(s) && !/PageHeader/.test(s)) continue;           // pengalihan rute lama
  if (/Kembali|ArrowLeft|router\.back\(\)|kembaliHref/.test(s)) continue;
  kurang.push(r);
}
if (!kurang.length) console.log("Semua halaman di luar menu punya tombol Kembali.");
else {
  console.log(`TANPA TOMBOL KEMBALI: ${kurang.length}`);
  for (const r of kurang.sort()) console.log("  ", r);
  process.exitCode = 1;
}
