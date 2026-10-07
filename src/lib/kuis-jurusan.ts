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

/* ───────────── Bank soal kuis (6 Oktober 2026) ─────────────
 * Permintaan user: "diperkaya pertanyaannya … bersifat global tapi tetap menjurus … soal yang banyak, yang tampil acak".
 * Bank disusun PANITIA (SiteSetting `spmb.kuis`, Pengaturan SPMB → Kuis Jurusan): tiap soal = situasi umum, tiap pilihan
 * mengarah ke SATU kode jurusan. Pilihan untuk jurusan yang tidak ada lagi dibuang; soal dengan <2 pilihan dilewati.
 * Bank kosong → kembali ke `susunKuis` dari data jurusan. Daftar jurusan tidak pernah ditulis di kode (#11). */

export type SoalBank = { id: string; tanya: string; pilihan: { kode: string; teks: string }[] };

export function bacaBankKuis(teks: string | undefined, kodeAda: string[]): SoalKuis[] {
  let mentah: unknown;
  try { mentah = JSON.parse(teks || "[]"); } catch { return []; }
  if (!Array.isArray(mentah)) return [];
  const ada = new Set(kodeAda);
  return (mentah as SoalBank[]).map(s => ({
    tanya: { id: String(s?.tanya ?? "").trim(), en: String(s?.tanya ?? "").trim() },
    pilihan: (Array.isArray(s?.pilihan) ? s.pilihan : [])
      .map(p => ({ kode: String(p?.kode ?? ""), teks: String(p?.teks ?? "").trim() }))
      .filter(p => p.teks && ada.has(p.kode)),
  })).filter(s => s.tanya.id && s.pilihan.length >= 2);
}

/** Ambil `n` soal acak dari bank + acak urutan pilihannya. Dipanggil di KLIK (bukan saat render) supaya tidak
 *  berbeda antara server & browser (#15). */
export function acakKuis(bank: SoalKuis[], n: number, acak: () => number = Math.random): SoalKuis[] {
  const kocok = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(acak() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return kocok(bank).slice(0, Math.max(2, Math.min(n, bank.length))).map(s => ({ ...s, pilihan: kocok(s.pilihan) }));
}
