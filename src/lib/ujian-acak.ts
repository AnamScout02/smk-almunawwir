/** Pengacakan soal & pilihan untuk SATU siswa — mengikuti tiga aturan Bimasoft yang sudah biasa
 * dipakai guru: pengambilan sampel ("Jumlah Soal" vs "Yang Harus Dikerjakan"), grouping
 * (soal-soal yang berbagi wacana tetap menempel & urut), dan locking (posisi tertentu dikunci).
 *
 * Deterministik: dengan `benih` yang sama, hasilnya selalu sama. Benih = id attempt, jadi
 * siswa yang memuat ulang halaman (koneksi putus, ganti komputer) menerima urutan yang PERSIS
 * sama — kalau tidak, jawaban yang sudah tersimpan jadi salah sasaran. Hasil pengacakan juga
 * disimpan ke `ExamAttempt.urutan`; fungsi ini yang menghasilkannya pertama kali. */

export interface SoalUntukAcak {
  id: string;
  tipe: string;
  stimulusId: string | null;
  posisiKunci: number | null;
  opsi: { kode: string }[];
  order: number;
}

export interface HasilAcak {
  /** id ExamQuestion, urut sesuai yang akan dilihat siswa. */
  urutanSoal: string[];
  /** id soal → urutan kode opsi yang ditampilkan. Kosong = tidak diacak. */
  urutanOpsi: Record<string, string[]>;
  /** Huruf paket ("A".."D") bila ujian memakai paket menurut denah — lihat `paketDariKursi`. */
  paket?: string;
}

export const HURUF_PAKET = "ABCD";

/** PAKET SOAL MENURUT DENAH (21 September 2026). Kursi bernomor berurutan per baris selebar `kolom` meja (sama dengan
 * cetak denah). 2 paket = pola papan catur (kiri-kanan & depan-belakang berbeda); 3 paket = (baris + kolom) mod 3 —
 * kiri-kanan, depan-belakang, dan satu arah diagonal berbeda; 4 paket = kedelapan tetangga termasuk diagonal berbeda. */
export function paketDariKursi(kursi: number, kolom: number, jumlah: number): number {
  const k = Math.max(1, kolom);
  const baris = Math.floor((kursi - 1) / k), lajur = (kursi - 1) % k;
  if (jumlah >= 4) return (baris % 2) * 2 + (lajur % 2);
  return (baris + lajur) % Math.max(2, Math.min(3, jumlah));
}

/** Pembangkit bilangan acak deterministik (mulberry32) dari sebuah string. */
function acakDari(benih: string): () => number {
  let h = 1779033703 ^ benih.length;
  for (let i = 0; i < benih.length; i++) {
    h = Math.imul(h ^ benih.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kocok<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tipe yang urutan opsinya BERMAKNA dan tidak boleh diacak. */
const OPSI_TETAP = new Set(["BENAR_SALAH", "MENJODOHKAN", "SURVEI"]);

export function acakUntukSiswa(
  soal: SoalUntukAcak[],
  aturan: { acakSoal: boolean; acakOpsi: boolean; jumlahDikerjakan?: number | null },
  benih: string,
): HasilAcak {
  const rnd = acakDari(benih);
  const urut = [...soal].sort((a, b) => a.order - b.order);

  // 1. Kelompokkan: soal ber-stimulus sama = satu rombongan yang tidak boleh dipisah.
  //    Soal tanpa stimulus = rombongan beranggota satu.
  const rombongan: SoalUntukAcak[][] = [];
  const perStimulus = new Map<string, SoalUntukAcak[]>();
  for (const s of urut) {
    if (s.stimulusId) {
      const r = perStimulus.get(s.stimulusId);
      if (r) r.push(s); else { const baru = [s]; perStimulus.set(s.stimulusId, baru); rombongan.push(baru); }
    } else rombongan.push([s]);
  }

  // 2. Pisahkan yang posisinya dikunci. Sebuah rombongan ikut terkunci kalau anggota pertamanya
  //    dikunci — posisi kunci berlaku untuk anggota pertama, sisanya menyusul di belakangnya.
  const terkunci = rombongan.filter(r => r[0].posisiKunci != null);
  let bebas = rombongan.filter(r => r[0].posisiKunci == null);

  // 3. Acak yang bebas.
  if (aturan.acakSoal) bebas = kocok(bebas, rnd);

  // 4. Pengambilan sampel: kalau "yang harus dikerjakan" lebih kecil dari jumlah soal, ambil
  //    sebagian dari rombongan bebas saja — soal terkunci selalu ikut (biasanya petunjuk,
  //    listening, atau uraian wajib). Sampel dihitung per BUTIR, rombongan diambil utuh sampai
  //    kuota terpenuhi supaya wacana tidak terpotong setengah.
  const jumlahTerkunci = terkunci.reduce((n, r) => n + r.length, 0);
  const kuota = aturan.jumlahDikerjakan && aturan.jumlahDikerjakan > 0
    ? Math.max(0, aturan.jumlahDikerjakan - jumlahTerkunci) : null;
  if (kuota !== null) {
    const ambil: SoalUntukAcak[][] = [];
    let n = 0;
    for (const r of bebas) { if (n >= kuota) break; ambil.push(r); n += r.length; }
    bebas = ambil;
  }

  // 5. Susun: taruh yang terkunci di posisinya, isi sisanya dengan yang bebas berurutan.
  const total = terkunci.reduce((n, r) => n + r.length, 0) + bebas.reduce((n, r) => n + r.length, 0);
  const hasil: (SoalUntukAcak | null)[] = Array(total).fill(null);
  const antrianKunci = [...terkunci].sort((a, b) => (a[0].posisiKunci ?? 0) - (b[0].posisiKunci ?? 0));
  for (const r of antrianKunci) {
    let pos = Math.min(Math.max((r[0].posisiKunci ?? 1) - 1, 0), total - r.length);
    // geser ke kanan kalau slotnya sudah terisi rombongan terkunci lain
    while (pos + r.length <= total && r.some((_, i) => hasil[pos + i] !== null)) pos++;
    if (pos + r.length > total) { pos = 0; while (r.some((_, i) => hasil[pos + i] !== null)) pos++; }
    r.forEach((s, i) => { hasil[pos + i] = s; });
  }
  const bebasDatar = bebas.flat();
  let k = 0;
  for (let i = 0; i < total; i++) if (hasil[i] === null) hasil[i] = bebasDatar[k++] ?? null;

  const urutanSoal = hasil.filter((s): s is SoalUntukAcak => s !== null).map(s => s.id);

  // 6. Acak opsi per soal (kecuali tipe yang urutannya bermakna).
  const urutanOpsi: Record<string, string[]> = {};
  if (aturan.acakOpsi) {
    for (const s of soal) {
      if (OPSI_TETAP.has(s.tipe) || !Array.isArray(s.opsi) || s.opsi.length < 2) continue;
      urutanOpsi[s.id] = kocok(s.opsi.map(o => o.kode), rnd);
    }
  }
  // URUTKAN: langkah SELALU diacak (lepas dari pengaturan acak pilihan) — urutan asli di basis data adalah
  // kuncinya. Bila hasil kocokan kebetulan sama dengan kunci, digeser satu supaya tidak pernah tampil sudah benar.
  for (const s of soal) {
    if (s.tipe !== "URUTKAN" || !Array.isArray(s.opsi) || s.opsi.length < 2) continue;
    const asli = s.opsi.map(o => o.kode);
    let acak = kocok(asli, rnd);
    if (acak.every((k, i) => k === asli[i])) acak = [...acak.slice(1), acak[0]];
    urutanOpsi[s.id] = acak;
  }
  return { urutanSoal, urutanOpsi };
}
