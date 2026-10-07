import { toProperCaseSchoolName } from "@/lib/text";

/** NAMA SEKOLAH ASAL — penulisan baku & pencocokan (6 Oktober 2026). NETRAL (dipakai formulir, server, portal).
 *
 *  Permintaan user: nama sekolah yang sama tapi beda kapital, singkatan (SMPN / SMP Negeri), tanda hubung
 *  (Al-Fatah / Al - Fatah / Al Fatah), salah ketik, atau berekor tempat (MTs Al Fatah / MTs Al Fatah Sragi)
 *  harus bisa disatukan — dan ditulis RAPI: "SMP Negeri 1 Songgon", "MTs Negeri", "MTs Al Fatah".
 *   - `bakuNamaSekolah`  : merapikan tulisan (TIDAK menebak sekolah lain) — aman dipakai otomatis saat simpan.
 *   - `kunciSekolah`     : kunci pembanding (huruf, angka, spasi saja).
 *   - `miripSekolah`     : dugaan "kemungkinan sama" (salah ketik / berekor tempat) — HANYA saran untuk panitia,
 *                          tidak pernah digabung otomatis ("SMP Negeri 1" bisa Songgon atau Sempu). */

/** Singkatan berstatus → bentuk panjang. Dicocokkan sebagai KATA UTUH. */
const PANJANG: [RegExp, string][] = [
  [/\bSMP\s*N\b\.?/gi, "SMP Negeri"], [/\bMTS\s*N\b\.?/gi, "MTs Negeri"], [/\bSD\s*N\b\.?/gi, "SD Negeri"],
  [/\bSMA\s*N\b\.?/gi, "SMA Negeri"], [/\bSMK\s*N\b\.?/gi, "SMK Negeri"], [/\bMIN\b/g, "MI Negeri"], [/\bMAN\b/g, "MA Negeri"],
  [/\bSMP\s*S\b\.?/gi, "SMP Swasta"], [/\bMTS\s*S\b\.?/gi, "MTs Swasta"],
  [/\bSMP\s*IT\b/gi, "SMP IT"], [/\bSD\s*IT\b/gi, "SD IT"], [/\bMTS\s*IT\b/gi, "MTs IT"],
];

export function bakuNamaSekolah(mentah: string | null | undefined): string {
  let s = String(mentah ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  // "Al-Fatah" / "Al - Fatah" / "Al -Fatah" → "Al Fatah" (juga El-, Ar-, As-, An-, Ad-, At-).
  s = s.replace(/\b(al|el|ar|as|an|ad|at|asy|adz)\s*-\s*/gi, "$1 ");
  // Tanda hubung berspasi lain → spasi; titik/koma pemisah → spasi.
  s = s.replace(/\s+-\s+/g, " ").replace(/[.,;]+(\s|$)/g, " ");
  for (const [pola, ganti] of PANJANG) s = s.replace(pola, ganti);
  s = toProperCaseSchoolName(s.replace(/\s+/g, " ").trim());
  // Kapitalisasi baku yang tidak diurus toProperCaseSchoolName.
  return s.replace(/\bIt\b/g, "IT").replace(/\bSmpn\b/g, "SMP Negeri").replace(/\bMtsn\b/g, "MTs Negeri")
    .replace(/\bSMPN\b/g, "SMP Negeri").replace(/\bMTsN\b/g, "MTs Negeri").replace(/\bSDN\b/g, "SD Negeri")
    .replace(/\bSMAN\b/g, "SMA Negeri").replace(/\bSMKN\b/g, "SMK Negeri").replace(/\bMIN\b/g, "MI Negeri").replace(/\bMAN\b/g, "MA Negeri");
}

/** Kunci pembanding: nama baku → HURUF BESAR, tanpa apostrof ("Manba'ul" = "Manbaul") & tanda baca. */
export function kunciSekolah(mentah: string | null | undefined): string {
  return bakuNamaSekolah(mentah).toUpperCase().replace(/['’`]/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
}

function jarak(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Dugaan sama (untuk SARAN panitia): salah ketik kecil, atau yang satu = yang lain + nama tempat di belakang. */
export function miripSekolah(a: string, b: string): boolean {
  const ka = kunciSekolah(a), kb = kunciSekolah(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // Angka sekolah berbeda ("SMP Negeri 1" vs "SMP Negeri 2") = pasti beda sekolah.
  const angka = (k: string) => (k.match(/\d+/g) ?? []).join(",");
  if (angka(ka) !== angka(kb)) return false;
  const pendek = ka.length <= kb.length ? ka : kb, panjang = pendek === ka ? kb : ka;
  // Berekor tempat: "MTS AL FATAH" ⊂ "MTS AL FATAH SRAGI" — minimal 3 kata supaya "SMP NEGERI" saja tidak ikut.
  if (panjang.startsWith(pendek + " ") && pendek.split(" ").length >= 3) return true;
  const batas = pendek.length >= 14 ? 2 : pendek.length >= 8 ? 1 : 0;
  return batas > 0 && jarak(ka, kb) <= batas;
}

export type VarianSekolah = { nama: string; jumlah: number };
export type KelompokSekolah = { saran: string; varian: VarianSekolah[]; pasti: boolean };

/** Kelompokkan nama mentah: SAMA PERSIS menurut kunci (pasti) lalu gabung kelompok yang MIRIP (dugaan).
 *  Hanya kelompok yang punya >1 varian penulisan yang dikembalikan. */
export function kelompokkanSekolah(daftar: VarianSekolah[]): KelompokSekolah[] {
  const perKunci = new Map<string, VarianSekolah[]>();
  for (const v of daftar) {
    const k = kunciSekolah(v.nama);
    if (!k) continue;
    perKunci.set(k, [...(perKunci.get(k) ?? []), v]);
  }
  const kunci = [...perKunci.keys()];
  const induk = kunci.map((_, i) => i);
  const akar = (i: number): number => (induk[i] === i ? i : (induk[i] = akar(induk[i])));
  for (let i = 0; i < kunci.length; i++) {
    for (let j = i + 1; j < kunci.length; j++) if (miripSekolah(kunci[i], kunci[j])) induk[akar(i)] = akar(j);
  }
  const grup = new Map<number, { varian: VarianSekolah[]; kunciBeda: number }>();
  kunci.forEach((k, i) => {
    const g = grup.get(akar(i)) ?? { varian: [], kunciBeda: 0 };
    g.varian.push(...perKunci.get(k)!);
    g.kunciBeda++;
    grup.set(akar(i), g);
  });
  return [...grup.values()]
    .filter(g => g.varian.length > 1 || g.varian.some(v => bakuNamaSekolah(v.nama) !== v.nama))
    .map(g => {
      const varian = g.varian.sort((a, b) => b.jumlah - a.jumlah);
      return { saran: bakuNamaSekolah(varian[0].nama), varian, pasti: g.kunciBeda === 1 };
    })
    .sort((a, b) => b.varian.reduce((t, v) => t + v.jumlah, 0) - a.varian.reduce((t, v) => t + v.jumlah, 0));
}
