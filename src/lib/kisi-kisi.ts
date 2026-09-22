import { labelTipe } from "@/lib/soal";

/** KISI-KISI SOAL — aturan bersama klien & server. Kolom kisi-kisi disimpan PER BUTIR SOAL (ExamQuestion &
 * QuestionBankItem): `kd`, `materi`, `indikator`, `levelKognitif`. Bentuk soal, nomor, dan skor diturunkan dari
 * soalnya sendiri, jadi tidak pernah diketik dua kali. Kolom ini tidak memengaruhi penilaian. */

export const LEVEL_KOGNITIF = [
  { value: "L1", label: "L1 · Pengetahuan & Pemahaman" },
  { value: "L2", label: "L2 · Aplikasi" },
  { value: "L3", label: "L3 · Penalaran" },
];

/** "l2", "Level 2", "LV.2", "2" → "L2"; selain level 1–3 → null. */
export function rapikanLevel(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase().replace(/[\s.]+/g, "");
  const m = s.match(/^(?:LEVEL|LV|L)?([123])$/);
  return m ? `L${m[1]}` : null;
}

export interface ButirKisi {
  nomor: number; tipe: string; skor: number;
  kd: string | null; materi: string | null; indikator: string | null; levelKognitif: string | null;
}

export interface BarisKisi { kd: string; materi: string; indikator: string; level: string; bentuk: string; nomor: number[]; skor: number }

export const kisiLengkap = (b: { kd?: string | null; materi?: string | null; indikator?: string | null; levelKognitif?: string | null }) =>
  !!(b.kd?.trim() && b.materi?.trim() && b.indikator?.trim() && b.levelKognitif);

/** Butir BERURUTAN dengan KD, materi, indikator, level & bentuk soal yang sama digabung satu baris (nomor soalnya
 * didaftar), sesuai format kisi-kisi yang lazim. Butir yang indikatornya masih kosong tidak digabung. */
export function susunBarisKisi(butir: ButirKisi[]): BarisKisi[] {
  const hasil: BarisKisi[] = [];
  for (const b of butir) {
    const baris = {
      kd: b.kd?.trim() || "", materi: b.materi?.trim() || "", indikator: b.indikator?.trim() || "",
      level: b.levelKognitif || "", bentuk: labelTipe(b.tipe),
    };
    const akhir = hasil[hasil.length - 1];
    const sama = akhir && baris.indikator && akhir.kd === baris.kd && akhir.materi === baris.materi
      && akhir.indikator === baris.indikator && akhir.level === baris.level && akhir.bentuk === baris.bentuk;
    if (sama) { akhir.nomor.push(b.nomor); akhir.skor += b.skor; }
    else hasil.push({ ...baris, nomor: [b.nomor], skor: b.skor });
  }
  return hasil;
}

/** [1,2,3,5,7,8] → "1–3, 5, 7, 8". */
export function rentangNomor(ns: number[]): string {
  const urut = [...ns].sort((a, b) => a - b);
  const bagian: string[] = [];
  for (let i = 0; i < urut.length; i++) {
    let j = i;
    while (j + 1 < urut.length && urut[j + 1] === urut[j] + 1) j++;
    bagian.push(j - i >= 2 ? `${urut[i]}–${urut[j]}` : urut.slice(i, j + 1).join(", "));
    i = j;
  }
  return bagian.join(", ");
}
