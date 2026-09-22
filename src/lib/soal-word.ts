import mammoth from "mammoth";
import { gantiRumusWord } from "@/lib/omml-latex";
import { simpanGambarSoal } from "@/lib/kompres-gambar";
import { HURUF, type Opsi, type Kunci, periksaButir } from "@/lib/soal";

/** Pembaca naskah soal dari berkas Word (.docx/.docm).
 *
 * Dibangun dari pembacaan 14 naskah SUNGGUHAN di arsip Drive sekolah (13 September 2026), yang
 * ternyata memakai EMPAT pola berbeda:
 *   1. Tabel template Bimasoft — kolom [No | Huruf | Teks]: baris soal = nomor + pertanyaan
 *      (sel gabungan), baris opsi = huruf A-E + teks.
 *   2. Daftar bernomor Word (<ol><li>) — huruf A-E TIDAK diketik, itu penomoran otomatis Word;
 *      pembaca yang hanya mencari teks "A." akan mengira soal-soal ini tidak punya pilihan.
 *   3. Paragraf polos "1. ..." lalu "A. ..." / "a) ..." — atau semuanya dalam satu paragraf yang
 *      dipisah baris paksa (<br>), seperti naskah Bahasa Inggris.
 *   4. Tabel dua kolom — nomor di kiri, soal + opsi di kanan (naskah Administrasi Umum).
 *   + Lembar uraian 2025-2026: tabel identitas lalu 10 pertanyaan sebagai daftar tanpa opsi.
 *
 * Tidak ada pembaca yang 100% benar untuk empat format sekaligus. Karena itu hasilnya BUKAN
 * langsung disimpan — dikembalikan sebagai daftar butir + peringatan per butir, lalu ditampilkan
 * ke guru untuk diperiksa dan dibetulkan sebelum masuk bank soal. Gambar ikut terbawa sebagai
 * data URI, <sup>/<sub> dipertahankan (pangkat pada soal Fisika/Matematika). */

export interface ButirImpor {
  nomor: number;
  tipe: "PG" | "PG_KOMPLEKS" | "BENAR_SALAH" | "MENJODOHKAN" | "ISIAN_SINGKAT" | "URAIAN";
  pertanyaan: string;   // HTML
  opsi: Opsi[];
  kunci: Kunci | null;
  peringatan: string[];
}

export interface HasilWord {
  butir: ButirImpor[];
  /** Judul/identitas yang terbaca di kepala naskah (mapel, kelas, guru) — untuk pra-isi formulir. */
  kepala: { mapel?: string; kelas?: string; guru?: string; judul?: string };
  pola: string;
  gambar: number;
  catatan: string[];
}

/* ----------------------------- alat bantu HTML ----------------------------- */

const hapusTag = (h: string) =>
  h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
const rapikanHtml = (h: string) =>
  h.replace(/\s+/g, " ").replace(/^(\s|<br\s*\/?>)+|(\s|<br\s*\/?>)+$/g, "").trim();

/** "A.", "a)", "(A)" di awal teks -> {huruf, sisa}. */
function ambilHuruf(t: string): { huruf: string; sisa: string } | null {
  const m = t.match(/^\s*\(?([A-Ha-h])[.)\]:]\s*([\s\S]*)$/);
  if (!m) return null;
  return { huruf: m[1].toUpperCase(), sisa: m[2].trim() };
}
/** "1.", "1)", "12. " di awal teks -> {nomor, sisa}. */
function ambilNomor(t: string): { nomor: number; sisa: string } | null {
  const m = t.match(/^\s*(\d{1,3})[.)]\s*([\s\S]*)$/);
  if (!m) return null;
  return { nomor: Number(m[1]), sisa: m[2].trim() };
}

/** Pecah HTML jadi blok-blok tingkat atas (p, li, tabel) secara berurutan. */
interface Blok { jenis: "p" | "li" | "tabel"; html: string; teks: string; baris?: string[][] }
function pecahBlok(html: string): Blok[] {
  const blok: Blok[] = [];
  const re = /<table[\s\S]*?<\/table>|<(?:ol|ul)[\s\S]*?<\/(?:ol|ul)>|<p[\s\S]*?<\/p>|<h[1-6][\s\S]*?<\/h[1-6]>/g;
  for (const m of html.matchAll(re)) {
    const h = m[0];
    if (h.startsWith("<table")) {
      const baris: string[][] = [];
      for (const tr of h.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
        baris.push([...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(td => rapikanHtml(td[1])));
      }
      blok.push({ jenis: "tabel", html: h, teks: hapusTag(h), baris });
    } else if (/^<(ol|ul)/.test(h)) {
      for (const li of h.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
        const isi = rapikanHtml(li[1].replace(/<\/?(ol|ul)[^>]*>/g, ""));
        blok.push({ jenis: "li", html: isi, teks: hapusTag(isi) });
      }
    } else {
      const isi = rapikanHtml(h.replace(/^<(p|h\d)[^>]*>|<\/(p|h\d)>$/g, ""));
      // Paragraf dengan baris paksa (<br>) sering memuat soal + semua opsinya sekaligus —
      // pecah jadi baris terpisah supaya polanya sama dengan paragraf biasa.
      for (const bagian of isi.split(/<br\s*\/?>/)) {
        const b = rapikanHtml(bagian);
        if (hapusTag(b)) blok.push({ jenis: "p", html: b, teks: hapusTag(b) });
      }
    }
  }
  return blok;
}

/* ----------------------------- pola pembacaan ----------------------------- */

/** Penanda jenis di awal pertanyaan (template sistem): [BENAR_SALAH], [MENJODOHKAN],
 * [ISIAN_SINGKAT], [URAIAN], [PG_KOMPLEKS]. Tanpa penanda = ditebak dari ada/tidaknya pilihan. */
const PENANDA = /^\s*(?:<[^>]+>\s*)*\[\s*(PG_KOMPLEKS|BENAR_SALAH|MENJODOHKAN|ISIAN_SINGKAT|URAIAN|PG)\s*\]\s*/i;

function bikinButir(nomor: number, pertanyaan: string, opsiTeks: { huruf?: string; html: string }[]): ButirImpor {
  const opsi: Opsi[] = opsiTeks.map((o, i) => ({ kode: o.huruf ?? HURUF[i], teks: o.html }));
  const m = hapusTag(pertanyaan).match(/^\[\s*(PG_KOMPLEKS|BENAR_SALAH|MENJODOHKAN|ISIAN_SINGKAT|URAIAN|PG)\s*\]/i);
  const ditandai = m ? (m[1].toUpperCase() as ButirImpor["tipe"]) : null;
  const tanya = ditandai ? pertanyaan.replace(PENANDA, "") : pertanyaan;
  const tipe: ButirImpor["tipe"] = ditandai ?? (opsi.length >= 2 ? "PG" : "URAIAN");
  const b: ButirImpor = { nomor, tipe, pertanyaan: tanya, opsi: [], kunci: null, peringatan: [] };

  if (tipe === "PG" || tipe === "PG_KOMPLEKS") {
    b.opsi = opsi;
    if (opsi.length < 2) b.peringatan.push("Pilihan kurang dari 2");
    else if (opsi.length < 4) b.peringatan.push(`Hanya ${opsi.length} pilihan terbaca`);
  } else if (tipe === "BENAR_SALAH") {
    // Pernyataan diambil dari baris "1) ...", "2) ..." di dalam pertanyaan, atau dari opsi A-E.
    const baris = hapusTag(tanya).split(/\s(?=\d{1,2}[).]\s)/).map(t => t.trim()).filter(t => /^\d{1,2}[).]/.test(t));
    const dariTeks = baris.map((t, i) => ({ kode: String(i + 1), teks: t.replace(/^\d{1,2}[).]\s*/, "") }));
    b.opsi = dariTeks.length >= 1 ? dariTeks : opsi.map((o, i) => ({ kode: String(i + 1), teks: o.teks }));
    if (dariTeks.length) b.pertanyaan = tanya.split(/(?=\b1[).]\s)/)[0];
    if (!b.opsi.length) b.peringatan.push("Belum ada pernyataan Benar/Salah");
  } else if (tipe === "MENJODOHKAN") {
    b.opsi = opsi.map((o, i) => ({ kode: String(i + 1), teks: o.teks }));
    b.kunci = { kanan: [], pasangan: {} };
    b.peringatan.push("Pilihan kanan & pasangan diisi di formulir");
  } else if (tipe === "ISIAN_SINGKAT") {
    b.kunci = { jawaban: [] };
    b.peringatan.push("Kunci isian diisi di Excel atau formulir");
  } else if (!ditandai) {
    b.peringatan.push("Tidak ada pilihan terbaca - dianggap uraian");
  }
  return b;
}

/** Pola 1: tabel template Bimasoft [No | Huruf | Teks] dengan sel gabungan pada baris soal. */
function bacaTabelBimasoft(blok: Blok[]): ButirImpor[] {
  const hasil: ButirImpor[] = [];
  for (const t of blok) {
    if (t.jenis !== "tabel" || !t.baris) continue;
    let aktif: { nomor: number; pertanyaan: string; opsi: { huruf: string; html: string }[] } | null = null;
    const tutup = () => { if (aktif) hasil.push(bikinButir(aktif.nomor, aktif.pertanyaan, aktif.opsi)); aktif = null; };
    for (const r of t.baris) {
      const sel = r.map(hapusTag);
      const iHuruf = sel.findIndex(s => /^[A-Ha-h]$/.test(s));
      const iNomor = sel.findIndex(s => /^\d{1,3}\.?$/.test(s));
      if (iHuruf >= 0 && r[iHuruf + 1] !== undefined) {
        if (aktif) aktif.opsi.push({ huruf: sel[iHuruf].toUpperCase(), html: r[iHuruf + 1] });
      } else if (iNomor >= 0) {
        tutup();
        const pertanyaan = r.filter((_, i) => i !== iNomor).find(x => hapusTag(x)) ?? "";
        aktif = { nomor: Number(sel[iNomor].replace(".", "")), pertanyaan, opsi: [] };
      } else if (aktif && sel.some(Boolean)) {
        aktif.pertanyaan += " " + r.filter(x => hapusTag(x)).join(" ");
      }
    }
    tutup();
  }
  return hasil;
}

/** Satu gumpalan HTML berisi pertanyaan + opsi (dipisah <br>, <li>, atau huruf "A."). */
function bacaSatuBlokSoal(nomor: number, html: string): ButirImpor | null {
  let potongan: string[] = [];
  if (/<li/.test(html)) {
    const sebelum = html.split(/<(?:ol|ul)[^>]*>/)[0];
    potongan = [sebelum, ...[...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => " " + m[1])];
  } else {
    potongan = html.split(/<br\s*\/?>/);
  }
  // pecah lagi kalau beberapa huruf ada dalam satu potongan ("... A. x B. y C. z")
  const rata: string[] = [];
  for (const p of potongan) rata.push(...p.split(/(?=(?:^|\s)\(?[A-Ea-e][.)]\s)/));
  let pertanyaan = "";
  const opsi: { huruf?: string; html: string }[] = [];
  for (const raw of rata) {
    const dariLi = raw.startsWith(" ");
    const p = rapikanHtml(raw.replace(/^ /, ""));
    if (!hapusTag(p)) continue;
    const h = ambilHuruf(hapusTag(p));
    if (h) opsi.push({ huruf: h.huruf, html: rapikanHtml(p.replace(/^\s*\(?[A-Ha-h][.)\]:]\s*/, "")) });
    else if (dariLi && pertanyaan) opsi.push({ html: p });
    else pertanyaan = pertanyaan ? pertanyaan + " " + p : p;
  }
  if (!hapusTag(pertanyaan)) return null;
  return bikinButir(nomor, pertanyaan.replace(/^\s*\d{1,3}[.)]\s*/, ""), opsi);
}

/** Pola 4: tabel dua kolom — nomor di kiri, soal + opsi menyatu di kanan. */
function bacaTabelDuaKolom(blok: Blok[]): ButirImpor[] {
  const hasil: ButirImpor[] = [];
  for (const t of blok) {
    if (t.jenis !== "tabel" || !t.baris) continue;
    for (const r of t.baris) {
      if (r.length < 2) continue;
      const nomor = Number(hapusTag(r[0]).replace(/\D/g, ""));
      if (!nomor) continue;
      const b = bacaSatuBlokSoal(nomor, r.slice(1).join(" "));
      if (b) hasil.push(b);
    }
  }
  return hasil;
}

/** Pola 2 & 3: urutan blok p/li. Soal dikenali dari nomor di awal, atau dari <li>/p yang tampak
 * seperti pertanyaan; opsi dari huruf A-E, atau dari <li> tanpa huruf yang menyusul soal
 * (penomoran otomatis Word). */
function bacaBerurutan(blok: Blok[]): ButirImpor[] {
  const hasil: ButirImpor[] = [];
  let aktif: { nomor: number; pertanyaan: string; opsi: { huruf?: string; html: string }[] } | null = null;
  let nomorJalan = 0;
  const tutup = () => {
    if (aktif && hapusTag(aktif.pertanyaan)) hasil.push(bikinButir(aktif.nomor, aktif.pertanyaan, aktif.opsi));
    aktif = null;
  };
  for (const b of blok) {
    if (b.jenis === "tabel") {
      // Tabel di NASKAH PARAGRAF hampir selalu bagian ISI soal (tabel data, jadwal, matriks) —
      // pola tabel-sebagai-tata-letak (Bimasoft & dua kolom) sudah dicoba lebih dulu dan gagal.
      // Dulu tabel di sini menutup soal yang sedang dibaca lalu DIBUANG, sehingga soal bertabel
      // hilang isinya (temuan user 20 September 2026: "upload word tidak bisa menampilkan soal
      // yang ada tabelnya"). Sekarang tabelnya diikutkan ke pertanyaan yang sedang aktif.
      if (aktif) aktif.pertanyaan = `${aktif.pertanyaan}${b.html}`;
      continue;
    }
    const teks = b.teks;
    const nom = ambilNomor(teks);
    const hur = ambilHuruf(teks);
    const tampakPertanyaan =
      /[?]\s*$|\.{3,}\s*$|\bberikut\b|\badalah\b|\bkecuali\b|\bmerupakan\b|\bjelaskan\b|\bsebutkan\b|\bgambarkan\b/i.test(teks)
      && teks.length > 25;

    if (nom) {
      tutup();
      nomorJalan = nom.nomor;
      aktif = { nomor: nom.nomor, pertanyaan: rapikanHtml(b.html.replace(/^\s*\d{1,3}[.)]\s*/, "")), opsi: [] };
    } else if (hur && aktif) {
      aktif.opsi.push({ huruf: hur.huruf, html: rapikanHtml(b.html.replace(/^\s*\(?[A-Ha-h][.)\]:]\s*/, "")) });
    } else if (b.jenis === "li") {
      if (aktif && !tampakPertanyaan && aktif.opsi.length < 5 && (aktif.opsi.length > 0 || teks.length < 160)) {
        aktif.opsi.push({ html: b.html });
      } else {
        tutup();
        aktif = { nomor: ++nomorJalan, pertanyaan: b.html, opsi: [] };
      }
    } else if (aktif && aktif.opsi.length === 0) {
      aktif.pertanyaan += " " + b.html; // lanjutan pertanyaan (baris kedua, gambar)
    } else if (aktif && aktif.opsi.length > 0) {
      if (tampakPertanyaan || teks.length > 60) { tutup(); aktif = { nomor: ++nomorJalan, pertanyaan: b.html, opsi: [] }; }
      else aktif.opsi[aktif.opsi.length - 1].html += " " + b.html;
    }
  }
  tutup();
  return hasil;
}

/** Kepala naskah: "Mata Pelajaran : PJOK X ALL", "Kelas : XI TKJ 1", "Guru Pengampu : ...". */
function bacaKepala(blok: Blok[]): HasilWord["kepala"] {
  const k: HasilWord["kepala"] = {};
  const semua: string[] = [];
  for (const b of blok.slice(0, 40)) {
    if (b.jenis === "tabel" && b.baris) for (const r of b.baris) semua.push(...r.map(hapusTag));
    else semua.push(b.teks);
  }
  const cari = (pola: RegExp) => {
    for (let i = 0; i < semua.length; i++) {
      const m = semua[i].match(pola);
      if (!m) continue;
      const nilai = (m[1] ?? "").replace(/^[:\s]+/, "").trim();
      if (nilai) return nilai;
      for (let j = i + 1; j < Math.min(i + 4, semua.length); j++) {
        const v = semua[j].replace(/^[:\s]+/, "").trim();
        if (v) return v;
      }
    }
    return undefined;
  };
  k.mapel = cari(/^(?:mata pelajaran|mapel)\s*:?\s*(.*)$/i);
  k.kelas = cari(/^(?:kelas|kls)\s*:?\s*(.*)$/i);
  k.guru = cari(/^(?:guru pengampu|guru|penyusun)\s*:?\s*(.*)$/i);
  k.judul = semua.find(t => /^(soal|lembar soal|sumatif|penilaian|ujian|pts|pas|sas|sts|uas|uts|psaj|ukk)\b/i.test(t) && t.length < 90);
  return k;
}

export async function bacaWord(buf: Buffer): Promise<HasilWord> {
  const catatan: string[] = [];
  let gambar = 0;
  let html = "";
  const pesan: string[] = [];
  try {
    // Rumus Equation Editor Word (OMML) dibuang mammoth → diubah dulu jadi teks $…$ (src/lib/omml-latex.ts).
    const rumus = await gantiRumusWord(buf).catch(() => ({ buf, jumlah: 0 }));
    if (rumus.jumlah) catatan.push(`${rumus.jumlah} rumus Word diubah menjadi rumus LaTeX — periksa tampilannya di pratinjau soal.`);
    const r = await mammoth.convertToHtml(
      { buffer: rumus.buf },
      {
        // Gambar dikompres & disimpan sebagai BERKAS (WebP, maks 1600 px) lalu dirujuk lewat URL —
        // bukan lagi ditanam sebagai base64 di teks soal. Kalau jenisnya tidak didukung / gagal
        // disimpan, jatuh kembali ke data URI supaya soal bergambar tetap tidak kehilangan gambar.
        convertImage: mammoth.images.imgElement(async (img) => {
          gambar += 1;
          const b64 = await img.read("base64");
          const url = await simpanGambarSoal(Buffer.from(b64, "base64"), img.contentType).catch(() => null);
          return { src: url ?? `data:${img.contentType};base64,${b64}` };
        }),
      },
    );
    html = r.value;
    pesan.push(...r.messages.map(m => m.message));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/body element|docx file/i.test(msg)) catatan.push("Berkas .doc lama tidak didukung - simpan ulang sebagai .docx di Word.");
    else catatan.push("Berkas tidak bisa dibaca: " + msg.slice(0, 120));
    return { butir: [], kepala: {}, pola: "-", gambar: 0, catatan };
  }

  const blok = pecahBlok(html);
  const kepala = bacaKepala(blok);

  // Coba tiap pola, pakai yang menghasilkan butir sah terbanyak.
  const kandidat = [
    { pola: "tabel-bimasoft", butir: bacaTabelBimasoft(blok) },
    { pola: "tabel-dua-kolom", butir: bacaTabelDuaKolom(blok) },
    { pola: "berurutan", butir: bacaBerurutan(blok) },
  ];
  // PG berbobot 3, uraian berbobot 1: berkas yang terbaca "semua uraian" hampir selalu berarti
  // pilihannya gagal dikenali, bukan naskah uraian sungguhan — pola lain yang menemukan PG
  // harus menang (kasus nyata: naskah Administrasi Umum bertabel dua kolom).
  const nilai = (k: { butir: ButirImpor[] }) =>
    k.butir.reduce((n, b) => n + (b.tipe === "PG"
      ? (b.opsi.length >= 2 ? 3 : 0)
      : (periksaButir({ tipe: b.tipe, pertanyaan: b.pertanyaan, opsi: b.opsi, kunci: b.kunci }).length === 0 ? 1 : 0)), 0);
  kandidat.sort((a, b) => nilai(b) - nilai(a) || b.butir.length - a.butir.length);
  const terbaik = kandidat[0];

  const nomorTerlihat = new Set<number>();
  for (const b of terbaik.butir) {
    if (nomorTerlihat.has(b.nomor)) b.peringatan.push("Nomor soal ganda");
    nomorTerlihat.add(b.nomor);
    for (const o of b.opsi) if (!hapusTag(o.teks)) b.peringatan.push(`Pilihan ${o.kode} kosong`);
  }
  if (terbaik.butir.length === 0) catatan.push("Tidak ada soal yang terbaca. Pastikan tiap soal diawali nomor (1., 2., ...) atau memakai template.");

  return { butir: terbaik.butir, kepala, pola: terbaik.pola, gambar, catatan };
}
