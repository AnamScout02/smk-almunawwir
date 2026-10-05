/** Kuis minat jurusan SPMB (2 Oktober 2026). Pertanyaannya DISUSUN dari data jurusan yang sudah
 *  diisi di Kelola Jurusan (keahlian, karier, fasilitas) — tidak ada daftar jurusan maupun jawaban
 *  yang ditulis mati di kode (CLAUDE.md #11). Jurusan baru otomatis ikut kuis begitu datanya diisi;
 *  pertanyaan yang hanya punya jawaban dari <2 jurusan dilewati. Murni & deterministik, supaya
 *  susunan pilihan sama di server dan browser. */

export type JurusanKuis = {
  code: string; name: string; tagline: string | null;
  skills: string[]; career: string[]; features: string[];
};
export type SoalKuis = { tanya: { id: string; en: string }; pilihan: { teks: string; kode: string }[] };

const RANCANGAN: { tanya: { id: string; en: string }; ambil: (m: JurusanKuis) => string | undefined }[] = [
  { tanya: { id: "Kegiatan mana yang paling ingin kamu kuasai?", en: "Which activity would you most like to master?" }, ambil: m => m.skills[0] },
  { tanya: { id: "Kalau sudah lulus, kamu ingin bekerja sebagai…", en: "After graduating, you'd like to work as…" }, ambil: m => m.career[0] },
  { tanya: { id: "Mana yang terdengar paling seru?", en: "Which one sounds the most fun?" }, ambil: m => m.skills[1] },
  { tanya: { id: "Profesi lain yang kamu bayangkan untuk dirimu…", en: "Another career you can picture yourself in…" }, ambil: m => m.career[1] },
  { tanya: { id: "Pilih satu keterampilan lagi yang menarik:", en: "Pick one more skill that interests you:" }, ambil: m => m.skills[2] },
  { tanya: { id: "Fasilitas belajar yang paling ingin kamu coba:", en: "The learning facility you'd most like to try:" }, ambil: m => m.features[0] },
  { tanya: { id: "Satu pilihan terakhir — mana yang paling kamu banget?", en: "One last pick — which feels most like you?" }, ambil: m => m.career[2] },
];

/** Hash teks sederhana — dipakai mengacak urutan pilihan TANPA Math.random (harus sama di server & browser). */
function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function susunKuis(jurusan: JurusanKuis[]): SoalKuis[] {
  return RANCANGAN.map((r, i) => ({
    tanya: r.tanya,
    pilihan: jurusan
      .map(m => ({ teks: (r.ambil(m) ?? "").trim(), kode: m.code }))
      .filter(p => p.teks)
      .sort((a, b) => hash(`${i}:${a.teks}`) - hash(`${i}:${b.teks}`)),
  })).filter(s => s.pilihan.length >= 2);
}

/** Skor per kode jurusan dari jawaban (indeks pilihan per soal). Diurutkan tertinggi dulu. */
export function hitungKuis(soal: SoalKuis[], jawaban: number[]): { kode: string; skor: number }[] {
  const skor = new Map<string, number>();
  jawaban.forEach((j, i) => { const k = soal[i]?.pilihan[j]?.kode; if (k) skor.set(k, (skor.get(k) ?? 0) + 1); });
  return [...skor].map(([kode, s]) => ({ kode, skor: s })).sort((a, b) => b.skor - a.skor);
}
