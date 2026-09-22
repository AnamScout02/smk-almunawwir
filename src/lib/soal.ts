/** ATURAN TUNGGAL jenis soal CBT — bentuk `opsi`, bentuk jawaban siswa, dan cara menilainya.
 *
 * Dipakai oleh: pembaca Word/Excel (impor), formulir bank soal, halaman ujian siswa, dan penilai
 * di server. Satu berkas supaya tidak pernah ada dua tafsir — bug klasik CBT adalah tampilan
 * mengira jawaban "A" sementara penilai mengira jawaban indeks 0.
 *
 * Delapan tipe, diambil dari yang benar-benar dipakai asesmen sekolah (AKM & ujian sekolah).
 * Padanan dengan makro template Word yang dipakai sekolah selama ini (Bimasoft):
 *   PG ← PilihanGanda · PG_KOMPLEKS ← Checklist · BENAR_SALAH ← BenarSalah ·
 *   MENJODOHKAN ← Penjodohan · ISIAN_SINGKAT ← isiansingkat · URAIAN ← isian ·
 *   UNGGAH ← upload · SURVEI ← Survey. */

export type TipeSoal =
  | "PG" | "PG_KOMPLEKS" | "BENAR_SALAH" | "MENJODOHKAN"
  | "ISIAN_SINGKAT" | "URAIAN" | "UNGGAH" | "SURVEI"
  | "TITIK_GAMBAR" | "SERET_LEPAS" | "URUTKAN" | "LISAN";

export const TIPE_SOAL: { value: TipeSoal; label: string; keterangan: string; otomatis: boolean }[] = [
  { value: "PG",            label: "Pilihan Ganda",         keterangan: "Satu jawaban benar dari A–E",                          otomatis: true },
  { value: "PG_KOMPLEKS",   label: "Pilihan Ganda Kompleks", keterangan: "Boleh lebih dari satu jawaban benar (centang)",        otomatis: true },
  { value: "BENAR_SALAH",   label: "Benar / Salah",          keterangan: "Tiap pernyataan dinilai Benar atau Salah",             otomatis: true },
  { value: "MENJODOHKAN",   label: "Menjodohkan",            keterangan: "Pasangkan butir kiri dengan pilihan kanan",             otomatis: true },
  { value: "ISIAN_SINGKAT", label: "Isian Singkat",          keterangan: "Jawaban satu kata/angka, dicocokkan dengan kunci",      otomatis: true },
  { value: "URAIAN",        label: "Uraian",                 keterangan: "Jawaban panjang, dikoreksi guru",                       otomatis: false },
  { value: "UNGGAH",        label: "Unggah Berkas",          keterangan: "Siswa mengunggah berkas jawaban, dikoreksi guru",      otomatis: false },
  // JAWABAN LISAN (22 September 2026) — siswa MEREKAM suara di browser (Bahasa Inggris/Arab, hafalan, presentasi singkat).
  // Rekaman disimpan di folder RAHASIA dan hanya diputar lewat rute berizin (src/lib/ujian-lisan.ts). Dikoreksi guru.
  { value: "LISAN",         label: "Jawaban Lisan (rekam suara)", keterangan: "Siswa merekam jawaban suaranya, dikoreksi guru",  otomatis: false },
  { value: "SURVEI",        label: "Survei",                 keterangan: "Tidak dinilai — hanya mengumpulkan pendapat",           otomatis: true },
  // SOAL INTERAKTIF (21 September 2026) — cocok untuk soal kejuruan (topologi jaringan TKJ, bagian bangunan DPIB).
  // Tidak bisa diimpor dari Word/Excel; dibuat lewat penyunting soal. Lihat src/components/ujian/SoalInteraktif.tsx.
  { value: "TITIK_GAMBAR",  label: "Klik Titik pada Gambar", keterangan: "Siswa mengetuk bagian yang benar pada gambar",          otomatis: true },
  { value: "SERET_LEPAS",   label: "Seret-Lepas ke Gambar",  keterangan: "Siswa menyeret label ke tempatnya pada gambar",         otomatis: true },
  { value: "URUTKAN",       label: "Urutkan Langkah",        keterangan: "Siswa menyusun langkah-langkah menjadi urutan benar",   otomatis: true },
];

export function labelTipe(t: string): string {
  return TIPE_SOAL.find(x => x.value === t)?.label ?? t;
}

/** Satu pilihan jawaban. `benar` hanya berarti untuk PG, PG_KOMPLEKS, dan BENAR_SALAH. */
export interface Opsi { kode: string; teks: string; benar?: boolean }

/** Bentuk `opsi` per tipe:
 *  PG / PG_KOMPLEKS : Opsi[] — kode A..E, satu (PG) atau beberapa (KOMPLEKS) ber-`benar: true`
 *  BENAR_SALAH      : Opsi[] — tiap butir = pernyataan; `benar: true` = pernyataan itu Benar
 *  MENJODOHKAN      : Opsi[] — butir KIRI (kode 1..n); pilihan KANAN ada di `kunci.kanan`
 *  ISIAN_SINGKAT    : [] — kunci di `kunci.jawaban` (daftar teks yang diterima)
 *  URAIAN / UNGGAH  : [] — `kunci.acuan` (jawaban acuan) + `kunci.rubrik` (pedoman penskoran), keduanya opsional
 *  LISAN            : [] — seperti URAIAN + `kunci.durasiMaks` (detik rekaman, bawaan 120)
 *  SURVEI           : Opsi[] — pilihan tanpa `benar` */
export interface Kunci {
  /** MENJODOHKAN: pilihan kanan [{kode:"A", teks}], dan pasangan {kodeKiri: kodeKanan}. */
  kanan?: Opsi[];
  pasangan?: Record<string, string>;
  /** ISIAN_SINGKAT: daftar jawaban yang diterima (tidak peka huruf besar/kecil & spasi tepi). */
  jawaban?: string[];
  /** URAIAN / UNGGAH: PEDOMAN PENSKORAN — kriteria & skornya, mis. "Tujuan tepat (4); langkah urut (6)". */
  rubrik?: string;
  /** URAIAN / UNGGAH: JAWABAN ACUAN — poin/contoh jawaban yang diharapkan (21 September 2026). Tercetak di Kartu Soal
   * & lampiran kunci kisi-kisi, tampil di layar Koreksi. Tidak pernah dikirim ke siswa selama ujian (`soalUntukSiswa`). */
  acuan?: string;
  /** TITIK_GAMBAR & SERET_LEPAS: URL gambar (ikut dikirim ke siswa lewat `soalUntukSiswa`, area-nya TIDAK). */
  gambar?: string;
  /** TITIK_GAMBAR: area yang benar. SERET_LEPAS: tempat tiap label (`kode` = kode opsi/label). Koordinat PERSEN gambar. */
  area?: AreaGambar[];
  /** URUTKAN: kode langkah dalam urutan yang benar. */
  urutan?: string[];
  /** LISAN: lama rekaman maksimal (detik). Ikut dikirim ke siswa (`soalUntukSiswa` → `durasiMaks`). */
  durasiMaks?: number;
}

/** Batas durasi rekaman jawaban lisan (detik). */
export const durasiLisan = (k: Kunci | null | undefined) => Math.min(600, Math.max(15, Math.round(Number(k?.durasiMaks) || 120)));

/** Kotak pada gambar, dalam PERSEN lebar/tinggi gambar (0–100) supaya tetap tepat di layar selebar apa pun. */
export interface AreaGambar { kode: string; x: number; y: number; w: number; h: number; label?: string }

/** Titik jawaban "x,y" (persen) → angka. */
export function uraiTitik(t: unknown): { x: number; y: number } | null {
  if (typeof t !== "string") return null;
  const [x, y] = t.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
/** Titik di dalam area — toleransi 1,5% supaya ketukan jari di tepi kotak tetap terhitung. */
export const diDalamArea = (t: { x: number; y: number }, a: AreaGambar, tol = 1.5) =>
  t.x >= a.x - tol && t.x <= a.x + a.w + tol && t.y >= a.y - tol && t.y <= a.y + a.h + tol;

/** Bentuk jawaban siswa yang disimpan di ExamAttempt.answers[examQuestionId]:
 *  PG            : "A"
 *  PG_KOMPLEKS   : ["A","C"]
 *  BENAR_SALAH   : { "1": true, "2": false }        (kode pernyataan → pilihan siswa)
 *  MENJODOHKAN   : { "1": "B", "2": "A" }           (kode kiri → kode kanan)
 *  ISIAN_SINGKAT : "teks"
 *  URAIAN        : "teks panjang"
 *  UNGGAH        : "/api/uploads/..."               (URL berkas)
 *  SURVEI        : "A"
 *  TITIK_GAMBAR  : ["12.5,40", "70,22.3"]          (titik yang diketuk, persen x,y)
 *  SERET_LEPAS   : { "1": "30,45", "2": "70,20" }   (kode label → titik tempat label diletakkan)
 *  URUTKAN       : ["3","1","2"]                    (kode langkah sesuai urutan susunan siswa) */
export type Jawaban = string | string[] | Record<string, string | boolean> | null;

export interface ButirUntukNilai {
  tipe: string;
  opsi: Opsi[];
  kunci: Kunci | null;
  skor: number;
}

const SUB_SUP: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
};
/** Pembanding jawaban ISIAN SINGKAT (22 Sep 2026: + rumus). Tidak peka huruf besar/kecil & spasi; koma desimal = titik
 * (0,5 = 0.5); rumus `$…$` dibandingkan tanpa tanda $ dan tanpa spasi; \ce{H2O} / \mathrm{…} dibuka isinya dan angka
 * indeks Unicode (H₂O) disamakan — jadi kunci "$\ce{H2SO4}$" menerima jawaban "H2SO4", "H₂SO₄", atau "$\ce{H2SO4}$". */
const rapikan = (s: unknown) => {
  let t = String(s ?? "").trim().replace(/[₀-₉⁰-⁹¹²³⁺⁻]/g, c => SUB_SUP[c] ?? c);
  if (/[$\\]/.test(t)) {
    t = t.replace(/\$+/g, "").replace(/\\(?:left|right)/g, "").replace(/\\[dt]frac/g, "\\frac");
    for (let i = 0; i < 3; i++) t = t.replace(/\\(?:ce|pu|mathrm|text|operatorname)\{([^{}]*)\}/g, "$1");
    t = t.replace(/\s+/g, "");
  }
  return t.toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ");
};

/** Nilai satu butir. Mengembalikan skor yang diraih (0 … skor), atau `null` kalau butir ini
 * harus dikoreksi manual (URAIAN, UNGGAH). SURVEI selalu 0 dan tidak dihitung dalam total. */
export function nilaiButir(b: ButirUntukNilai, jawaban: Jawaban): number | null {
  const opsi = Array.isArray(b.opsi) ? b.opsi : [];
  switch (b.tipe) {
    case "PG": {
      const benar = opsi.find(o => o.benar)?.kode;
      return benar && jawaban === benar ? b.skor : 0;
    }
    case "PG_KOMPLEKS": {
      // Semua-atau-tidak: himpunan yang dicentang harus PERSIS sama dengan himpunan kunci.
      // Ini aturan yang dipakai AKM; skor parsial sengaja tidak diberikan supaya siswa tidak
      // "mencentang semua".
      const kunci = opsi.filter(o => o.benar).map(o => o.kode).sort().join(",");
      const jwb = Array.isArray(jawaban) ? [...jawaban].sort().join(",") : "";
      return kunci && jwb === kunci ? b.skor : 0;
    }
    case "BENAR_SALAH": {
      // Skor proporsional: tiap pernyataan bernilai skor/n.
      if (!opsi.length || typeof jawaban !== "object" || jawaban === null || Array.isArray(jawaban)) return 0;
      const per = b.skor / opsi.length;
      let raih = 0;
      for (const o of opsi) {
        const j = (jawaban as Record<string, unknown>)[o.kode];
        if (typeof j === "boolean" && j === !!o.benar) raih += per;
      }
      return Math.round(raih * 100) / 100;
    }
    case "MENJODOHKAN": {
      const pasangan = b.kunci?.pasangan ?? {};
      const kiri = Object.keys(pasangan);
      if (!kiri.length || typeof jawaban !== "object" || jawaban === null || Array.isArray(jawaban)) return 0;
      const per = b.skor / kiri.length;
      let raih = 0;
      for (const k of kiri) if ((jawaban as Record<string, unknown>)[k] === pasangan[k]) raih += per;
      return Math.round(raih * 100) / 100;
    }
    case "ISIAN_SINGKAT": {
      const terima = (b.kunci?.jawaban ?? []).map(rapikan).filter(Boolean);
      return terima.includes(rapikan(jawaban)) ? b.skor : 0;
    }
    case "TITIK_GAMBAR": {
      // Proporsional: tiap area benar yang KENA bernilai skor/n. Satu area hanya dihitung sekali; titik lebih dari
      // jumlah area diabaikan (layar siswa membatasinya), jadi mengetuk sembarang tempat tidak menaikkan skor.
      const area = b.kunci?.area ?? [];
      if (!area.length || !Array.isArray(jawaban)) return 0;
      const kena = new Set<string>();
      for (const t of jawaban.slice(0, area.length).map(uraiTitik)) {
        if (!t) continue;
        const a = area.find(x => !kena.has(x.kode) && diDalamArea(t, x));
        if (a) kena.add(a.kode);
      }
      return Math.round((b.skor * kena.size / area.length) * 100) / 100;
    }
    case "SERET_LEPAS": {
      // Proporsional per label: benar bila titik letaknya berada di area milik label itu.
      const area = b.kunci?.area ?? [];
      if (!area.length || typeof jawaban !== "object" || jawaban === null || Array.isArray(jawaban)) return 0;
      let benar = 0;
      for (const a of area) {
        const t = uraiTitik((jawaban as Record<string, unknown>)[a.kode]);
        if (t && diDalamArea(t, a)) benar++;
      }
      return Math.round((b.skor * benar / area.length) * 100) / 100;
    }
    case "URUTKAN": {
      // Proporsional per posisi: langkah yang berada di posisi yang benar.
      const urutan = b.kunci?.urutan?.length ? b.kunci.urutan : opsi.map(o => o.kode);
      if (!urutan.length || !Array.isArray(jawaban)) return 0;
      const pas = urutan.filter((k, i) => jawaban[i] === k).length;
      return Math.round((b.skor * pas / urutan.length) * 100) / 100;
    }
    case "SURVEI":
      return 0;
    case "URAIAN":
    case "UNGGAH":
    case "LISAN":
    default:
      return null;
  }
}

/** Apakah butir ini butuh koreksi manual guru. */
export const butuhKoreksi = (tipe: string) => tipe === "URAIAN" || tipe === "UNGGAH" || tipe === "LISAN";

/** Banyaknya butir yang belum dikoreksi guru (skor null di `skorButir`) — > 0 berarti nilai sementara. */
export const hitungBelumDikoreksi = (skorButir: unknown): number =>
  Object.values((skorButir as Record<string, number | null>) ?? {}).filter(v => v === null).length;

/** Apakah butir ini ikut dihitung dalam total skor ujian. */
export const ikutDinilai = (tipe: string) => tipe !== "SURVEI";

/** Apakah jawaban siswa untuk butir ini sudah terisi (dipakai penanda "sudah dijawab"). */
export function sudahDijawab(tipe: string, jawaban: Jawaban): boolean {
  if (jawaban === null || jawaban === undefined) return false;
  if (typeof jawaban === "string") return jawaban.trim().length > 0;
  if (Array.isArray(jawaban)) return jawaban.length > 0;
  return Object.keys(jawaban).length > 0;
}

/** Periksa kelengkapan butir sebelum disimpan ke bank/ujian. Mengembalikan daftar masalah
 * (kosong = sah). Dipakai formulir DAN importir, supaya soal cacat tidak pernah masuk. */
export function periksaButir(b: { tipe: string; pertanyaan: string; opsi: Opsi[]; kunci: Kunci | null }): string[] {
  const m: string[] = [];
  const opsi = Array.isArray(b.opsi) ? b.opsi : [];
  if (!b.pertanyaan || !b.pertanyaan.replace(/<[^>]+>/g, "").trim()) m.push("Pertanyaan kosong");
  switch (b.tipe) {
    case "PG":
      if (opsi.length < 2) m.push("Pilihan kurang dari 2");
      if (opsi.filter(o => o.benar).length !== 1) m.push("Harus tepat satu pilihan benar");
      break;
    case "PG_KOMPLEKS":
      if (opsi.length < 2) m.push("Pilihan kurang dari 2");
      if (!opsi.some(o => o.benar)) m.push("Belum ada pilihan yang ditandai benar");
      break;
    case "BENAR_SALAH":
      if (opsi.length < 1) m.push("Belum ada pernyataan");
      break;
    case "MENJODOHKAN": {
      const kanan = b.kunci?.kanan ?? [];
      const pasangan = b.kunci?.pasangan ?? {};
      if (opsi.length < 2) m.push("Butir kiri kurang dari 2");
      if (kanan.length < 2) m.push("Pilihan kanan kurang dari 2");
      for (const o of opsi) if (!pasangan[o.kode]) m.push(`Butir ${o.kode} belum punya pasangan`);
      break;
    }
    case "ISIAN_SINGKAT":
      if (!(b.kunci?.jawaban ?? []).some(j => j.trim())) m.push("Kunci jawaban kosong");
      break;
    case "SURVEI":
      if (opsi.length < 2) m.push("Pilihan kurang dari 2");
      break;
    case "TITIK_GAMBAR":
      if (!b.kunci?.gambar) m.push("Gambar belum diunggah");
      if (!(b.kunci?.area ?? []).length) m.push("Belum ada area jawaban benar pada gambar");
      break;
    case "SERET_LEPAS": {
      if (!b.kunci?.gambar) m.push("Gambar belum diunggah");
      const area = b.kunci?.area ?? [];
      if (area.length < 2) m.push("Minimal 2 label beserta tempatnya");
      for (const o of opsi) if (!o.teks.trim()) m.push(`Label ${o.kode} belum bernama`);
      for (const o of opsi) if (!area.some(a => a.kode === o.kode)) m.push(`Label ${o.kode} belum punya tempat di gambar`);
      break;
    }
    case "URUTKAN":
      if (opsi.length < 2) m.push("Minimal 2 langkah");
      for (const o of opsi) if (!o.teks.replace(/<[^>]+>/g, "").trim()) { m.push("Ada langkah yang masih kosong"); break; }
      break;
  }
  return m;
}

/** Huruf pilihan standar. */
export const HURUF = ["A", "B", "C", "D", "E", "F", "G", "H"];
