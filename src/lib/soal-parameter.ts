/** SOAL BERPARAMETER (21 September 2026) — permintaan user: soal esai/praktik yang jawabannya BERBEDA tiap siswa, misal
 * "alokasikan IP sesuai milik masing-masing" pada soal topologi jaringan. Guru menulis variabel di soal, pilihan, kunci
 * isian, jawaban acuan, dan pedoman penskoran; tiap siswa melihat angkanya sendiri, jawaban acuan di layar koreksi ikut
 * menyesuaikan siswa itu, dan Isian Singkat dinilai otomatis per siswa.
 *
 *   {ABSEN} nomor absen siswa di kelasnya (urut nama — sama dengan nomor peserta ujian)
 *   {NIS2}  dua digit terakhir NIS       {NIS3} tiga digit terakhir NIS
 *   {ACAK}  angka 1–99 acak tetapi TETAP untuk siswa itu di ujian itu
 * Boleh berhitung: {ABSEN*4}, {ABSEN+10}, {(ABSEN*4)+1}, {ACAK%8}. Hanya angka, variabel di atas, + - * / % dan kurung —
 * diurai sendiri (bukan eval). Kurung kurawal lain (mis. himpunan {1, 2, 3}) tidak disentuh.
 * Murni: dipakai server (layar siswa, penilaian, koreksi) dan penyunting soal (pratinjau). */

export interface VarSiswa { ABSEN: number; NIS2: number; NIS3: number; ACAK: number }
export const NAMA_VARIABEL = ["ABSEN", "NIS2", "NIS3", "ACAK"] as const;
export const KETERANGAN_VARIABEL: Record<(typeof NAMA_VARIABEL)[number], string> = {
  ABSEN: "nomor absen siswa di kelasnya (urut nama)",
  NIS2: "dua digit terakhir NIS",
  NIS3: "tiga digit terakhir NIS",
  ACAK: "angka 1–99, acak tetapi tetap untuk siswa itu",
};
export const CONTOH_VARIABEL: VarSiswa = { ABSEN: 7, NIS2: 23, NIS3: 123, ACAK: 42 };

const POLA = /\{([A-Z0-9+\-*/%().\s]+)\}/g;

function token(expr: string): string[] | null {
  const t = expr.match(/\d+(?:\.\d+)?|[A-Z][A-Z0-9]*|[+\-*/%()]|\S/g) ?? [];
  return t.every(x => /^\d/.test(x) || (NAMA_VARIABEL as readonly string[]).includes(x) || "+-*/%()".includes(x)) ? t : null;
}

/** Hitung satu ungkapan; null bila tidak sah (dibiarkan apa adanya). */
function hitung(expr: string, v: VarSiswa): number | null {
  const t = token(expr);
  if (!t || !t.some(x => /^[A-Z]/.test(x))) return null; // wajib memuat variabel — "{2+3}" bukan parameter
  let i = 0;
  const jumlah = (): number => {
    let n = kali();
    while (t[i] === "+" || t[i] === "-") n = t[i++] === "+" ? n + kali() : n - kali();
    return n;
  };
  const kali = (): number => {
    let n = unsur();
    while (t[i] === "*" || t[i] === "/" || t[i] === "%") {
      const op = t[i++], b = unsur();
      n = op === "*" ? n * b : op === "/" ? n / b : n % b;
    }
    return n;
  };
  const unsur = (): number => {
    const x = t[i++];
    if (x === "-") return -unsur();
    if (x === "(") { const n = jumlah(); if (t[i++] !== ")") throw new Error("kurung"); return n; }
    if (x !== undefined && /^\d/.test(x)) return Number(x);
    if (x !== undefined && x in v) return v[x as keyof VarSiswa];
    throw new Error("unsur");
  };
  try {
    const n = jumlah();
    return i === t.length && Number.isFinite(n) ? n : null;
  } catch { return null; }
}

const tulisAngka = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ","));

export function adaParameter(t: unknown): boolean {
  if (typeof t !== "string" || !t.includes("{")) return false;
  for (const m of t.matchAll(POLA)) if (hitung(m[1], CONTOH_VARIABEL) !== null) return true;
  return false;
}

export function isiParameter(t: string, v: VarSiswa): string {
  if (!t.includes("{")) return t;
  return t.replace(POLA, (utuh, isi: string) => { const n = hitung(isi, v); return n === null ? utuh : tulisAngka(n); });
}

type ButirParam = { pertanyaan: string; opsi: unknown; kunci: unknown };

/** Apakah butir memakai parameter di mana pun (soal, pilihan, kunci isian, jawaban acuan, pedoman). */
export function butirBerparameter(q: ButirParam): boolean {
  if (adaParameter(q.pertanyaan)) return true;
  if (Array.isArray(q.opsi) && q.opsi.some(o => adaParameter((o as { teks?: string }).teks))) return true;
  const k = (q.kunci ?? {}) as { jawaban?: string[]; acuan?: string; rubrik?: string };
  return (k.jawaban ?? []).some(adaParameter) || adaParameter(k.acuan) || adaParameter(k.rubrik);
}

/** Salinan butir dengan semua parameter diisi nilai milik satu siswa. */
export function isiButirParameter<T extends ButirParam>(q: T, v: VarSiswa): T {
  if (!butirBerparameter(q)) return q;
  const k = q.kunci && typeof q.kunci === "object" ? { ...(q.kunci as Record<string, unknown>) } : q.kunci;
  if (k && typeof k === "object") {
    const kk = k as { jawaban?: string[]; acuan?: string; rubrik?: string };
    if (Array.isArray(kk.jawaban)) kk.jawaban = kk.jawaban.map(j => isiParameter(j, v));
    if (typeof kk.acuan === "string") kk.acuan = isiParameter(kk.acuan, v);
    if (typeof kk.rubrik === "string") kk.rubrik = isiParameter(kk.rubrik, v);
  }
  return {
    ...q,
    pertanyaan: isiParameter(q.pertanyaan, v),
    opsi: Array.isArray(q.opsi) ? q.opsi.map(o => ({ ...(o as object), teks: isiParameter(String((o as { teks?: string }).teks ?? ""), v) })) : q.opsi,
    kunci: k,
  };
}

/** Nilai variabel satu siswa. `benih` (id ujian + id siswa) membuat {ACAK} tetap sama tiap kali soal dibuka. */
export function varSiswa(o: { absen: number; nis: string; benih: string }): VarSiswa {
  const digit = (o.nis ?? "").replace(/\D/g, "");
  let h = 2166136261;
  for (let i = 0; i < o.benih.length; i++) h = Math.imul(h ^ o.benih.charCodeAt(i), 16777619);
  return { ABSEN: o.absen, NIS2: Number(digit.slice(-2) || 0), NIS3: Number(digit.slice(-3) || 0), ACAK: ((h >>> 0) % 99) + 1 };
}
