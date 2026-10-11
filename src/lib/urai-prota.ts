/** URAI PROTA/PROMES DARI BERKAS GURU (10 Okt 2026, pilihan user) — murni, tanpa pustaka: masukannya TABEL (baris × sel
 *  teks) dari Excel/Word dan baris lepas dari Word. Keluarannya butir { materi, jp, pekanMulai, pekanSelesai } untuk
 *  DITINJAU guru di penyunting Prota — tidak pernah langsung disimpan: format berkas guru beragam dan dugaan bisa meleset.
 *
 *  Cara membaca tabel:
 *   - baris judul = baris pertama yang punya sel berisi kata kunci materi (materi, lingkup, tujuan pembelajaran, elemen,
 *     capaian, kompetensi, pokok bahasan, topik);
 *   - kolom JP = sel judul berisi "jp", "jam", atau "alokasi"; kolom pekan = "pekan"/"minggu" (boleh "3-5");
 *   - Promes berbentuk KISI MINGGU (bulan di atas, angka 1–5 di bawahnya): deretan ≥ 8 kolom berjudul angka 1–6 dianggap
 *     kisi pekan; pekan mulai/selesai = kolom terisi pertama/terakhir pada baris itu, JP = jumlah angka di kisi bila kolom
 *     JP tidak ada;
 *   - baris "jumlah/total", baris kosong, dan baris yang materinya hanya angka dilewati.
 *  Tanpa tabel yang dikenali → tiap baris bernomor/berbutir dari naskah menjadi satu materi; "(4 JP)" di ujungnya dibaca. */
export interface ButirImpor { materi: string; jp: number; pekanMulai: number | null; pekanSelesai: number | null; catatan: string | null }
export interface HasilUraiProta { butir: ButirImpor[]; cara: "TABEL" | "KISI" | "DAFTAR" | "KOSONG"; kolomMateri?: string; catatan: string[] }

const rapi = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();
const KATA_MATERI = /(materi|lingkup|tujuan pembelajaran|\btp\b|elemen|capaian|kompetensi|pokok bahasan|topik|\bbab\b|sub ?bab|uraian)/i;
const KATA_JP = /(^|\b)(jp|jam|alokasi|jpl)(\b|$)/i;
const KATA_PEKAN = /(pekan|minggu)/i;
const KATA_LEWAT = /^(jumlah|total|sub ?total|cadangan|keterangan|mengetahui|kepala sekolah|guru mata pelajaran)\b/i;
const angka = (t: string) => { const m = /\d+(?:[.,]\d+)?/.exec(t); return m ? Math.round(Number(m[0].replace(",", "."))) : 0; };

function dariTabel(tabel: string[][]): HasilUraiProta | null {
  const baris = tabel.map(b => b.map(rapi));
  const iJudul = baris.findIndex(b => b.some(s => KATA_MATERI.test(s) && s.length < 60));
  if (iJudul < 0) return null;
  const judul = baris[iJudul];
  // Kolom materi: yang paling "kaya teks" di antara kolom berkata kunci (Prota sering punya Elemen + TP + Materi sekaligus).
  const calon = judul.map((s, i) => ({ i, s })).filter(x => KATA_MATERI.test(x.s) && x.s.length < 60);
  const isi = baris.slice(iJudul + 1);
  const panjang = (i: number) => isi.reduce((n, b) => n + (b[i]?.length ?? 0), 0);
  const kMateri = calon.sort((a, b) => panjang(b.i) - panjang(a.i))[0].i;
  const kJp = judul.findIndex((s, i) => i !== kMateri && KATA_JP.test(s) && !KATA_PEKAN.test(s));
  const kPekan = judul.findIndex((s, i) => i !== kMateri && KATA_PEKAN.test(s) && !/^\d+$/.test(s));
  // Kisi minggu: cari di baris judul ATAU baris tepat di bawahnya (judul dua tingkat: bulan / 1 2 3 4 5).
  const barisKisi = [judul, baris[iJudul + 1] ?? []].find(b => b.filter(s => /^[1-6]$/.test(s)).length >= 8);
  const kolomKisi = barisKisi ? barisKisi.map((s, i) => (/^[1-6]$/.test(s) ? i : -1)).filter(i => i >= 0) : [];
  const mulaiIsi = barisKisi && barisKisi !== judul ? iJudul + 2 : iJudul + 1;

  const butir: ButirImpor[] = [];
  let terakhir: ButirImpor | null = null;
  for (const b of baris.slice(mulaiIsi)) {
    const materi = rapi(b[kMateri]);
    const gabungan = b.join(" ").trim();
    if (!gabungan || KATA_LEWAT.test(materi) || KATA_LEWAT.test(rapi(b[0]))) continue;
    let pm: number | null = null, ps: number | null = null, jpKisi = 0;
    if (kolomKisi.length) {
      const terisi = kolomKisi.map((k, urut) => ({ urut: urut + 1, v: rapi(b[k]) })).filter(x => x.v);
      if (terisi.length) { pm = terisi[0].urut; ps = terisi[terisi.length - 1].urut; jpKisi = terisi.reduce((n, x) => n + angka(x.v), 0); }
    } else if (kPekan >= 0) {
      const m = /(\d+)\s*(?:[-–—s/d]+\s*(\d+))?/.exec(rapi(b[kPekan]));
      if (m) { pm = Number(m[1]); ps = m[2] ? Number(m[2]) : pm; }
    }
    const jp = kJp >= 0 ? angka(rapi(b[kJp])) : jpKisi;
    if (!materi || /^\d+([.,]\d+)?$/.test(materi)) {
      // Sel materi digabung ke bawah (baris lanjutan): JP & pekan ikut ke butir sebelumnya.
      if (terakhir && (jp || pm)) { terakhir.jp += jp; if (pm) { terakhir.pekanMulai ??= pm; terakhir.pekanSelesai = Math.max(terakhir.pekanSelesai ?? 0, ps ?? pm); } }
      continue;
    }
    terakhir = { materi: materi.slice(0, 300), jp, pekanMulai: pm, pekanSelesai: ps, catatan: null };
    butir.push(terakhir);
  }
  if (!butir.length) return null;
  const catatan: string[] = [];
  if (kJp < 0 && !kolomKisi.length) catatan.push("Kolom JP tidak ditemukan — isi JP tiap materi sebelum menyimpan.");
  if (kPekan < 0 && !kolomKisi.length) catatan.push("Kolom pekan tidak ditemukan — pekan dikosongkan.");
  if (kolomKisi.length) catatan.push("Pekan dibaca dari urutan kolom minggu di berkas. Cocokkan dengan nomor pekan efektif di tabel atas bila berkas Anda memuat minggu libur.");
  return { butir, cara: kolomKisi.length ? "KISI" : "TABEL", kolomMateri: judul[kMateri], catatan };
}

export function uraiProta(tabel: string[][][], lepas: string[] = []): HasilUraiProta {
  // Tabel terbaik = yang menghasilkan butir terbanyak (berkas sering memuat tabel identitas di atas tabel program).
  const hasil = tabel.map(dariTabel).filter((x): x is HasilUraiProta => !!x).sort((a, b) => b.butir.length - a.butir.length)[0];
  if (hasil) return { ...hasil, butir: hasil.butir.slice(0, 200) };
  const butir: ButirImpor[] = [];
  for (const mentah of lepas) {
    const t = rapi(mentah);
    const m = /^(?:\d{1,2}[.)]|[-•*–])\s+(.{4,})$/.exec(t);
    if (!m || KATA_LEWAT.test(m[1])) continue;
    const jp = /\(?\b(\d{1,3})\s*(?:jp|jam)\b\)?\s*$/i.exec(m[1]);
    butir.push({ materi: (jp ? m[1].slice(0, jp.index) : m[1]).replace(/[\s:–-]+$/, "").slice(0, 300), jp: jp ? Number(jp[1]) : 0, pekanMulai: null, pekanSelesai: null, catatan: null });
  }
  if (butir.length) return { butir: butir.slice(0, 200), cara: "DAFTAR", catatan: ["Berkas tidak memuat tabel program yang dikenali — yang dibaca daftar bernomor di naskahnya. Periksa JP dan pekannya."] };
  return { butir: [], cara: "KOSONG", catatan: ["Tidak ada tabel atau daftar materi yang bisa dikenali di berkas ini."] };
}
