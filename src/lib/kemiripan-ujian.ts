import "server-only";
import { prisma } from "@/lib/prisma";
import { butuhKoreksi, type Jawaban } from "@/lib/soal";

/** DETEKSI KEMIRIPAN JAWABAN (20 September 2026).
 *
 * Soal & pilihan sudah diacak per siswa, jadi dua siswa yang duduk bersebelahan TIDAK melihat
 * naskah yang sama urutannya. Karena itu kesamaan yang paling berarti bukan "sama-sama benar"
 * — soal mudah memang dijawab benar semua orang — melainkan **SAMA-SAMA SALAH DENGAN PILIHAN
 * YANG PERSIS SAMA**. Pola itu sulit terjadi kebetulan: pada soal 4 pilihan, dua orang yang
 * sama-sama salah punya sekitar 1 dari 3 peluang memilih pengecoh yang sama.
 *
 * Keluarannya SELALU berupa daftar pasangan untuk DIPERIKSA MANUSIA, bukan tuduhan dan bukan
 * tindakan otomatis. Angka apa pun di sini bukan bukti; pengawas yang memutuskan.
 *
 * Kode pilihan (`Opsi.kode`) TETAP sama antar siswa — pengacakan hanya mengubah urutan tampil —
 * jadi membandingkan jawaban mentah memang sah. Itu pula sebabnya edit soal saat ujian berjalan
 * dilarang menambah/menghapus pilihan (lihat route soal-live).
 *
 * Soal uraian & unggah TIDAK dibandingkan: penilaiannya manual dan teksnya bebas.
 *
 * DIPERKAYA 21 September 2026 (permintaan user): tiap pasangan diberi SKOR RISIKO gabungan dari
 *   1. kemiripan jawaban salah (di atas),
 *   2. POSISI DUDUK dari Denah Ruang (bersebelahan / depan-belakang / diagonal / seruang) — kursi diberi nomor
 *      berurutan per baris selebar `RuangUjian.kolom`, sama dengan cetak denah,
 *   3. KORELASI POLA WAKTU per soal (`ExamAttempt.waktuSoal`, dicatat denyut) — dua orang yang lama/cepat di soal
 *      yang sama persis.
 * Ambang untuk pasangan yang duduk berdekatan dilonggarkan sedikit. Ditambah daftar siswa yang selesai jauh
 * lebih cepat dari teman-temannya. Tetap: daftar untuk DIPERIKSA, bukan vonis. */

export interface PasanganMirip {
  a: { attemptId: string; nama: string; nis: string; kelas: string | null };
  b: { attemptId: string; nama: string; nis: string; kelas: string | null };
  /** Butir yang DIJAWAB kedua-duanya (hanya tipe yang dinilai otomatis). */
  bersama: number;
  /** Butir yang kedua-duanya SALAH. */
  salahBersama: number;
  /** Dari butir salah bersama, yang pilihannya PERSIS SAMA — inti sinyalnya. */
  salahSama: number;
  /** salahSama / salahBersama (0–1). */
  indeks: number;
  /** Nomor soal yang salah dengan jawaban sama — supaya pengawas bisa memeriksa langsung. */
  nomor: number[];
  /** Posisi duduk keduanya bila kegiatan memakai Denah Ruang. */
  posisi: { jenis: JenisPosisi; ruang: string; sesi: number; kursiA: number; kursiB: number } | null;
  /** Korelasi pola waktu per soal (−1..1), null bila butir bersama terlalu sedikit. */
  korelasiWaktu: number | null;
  /** Skor gabungan 0–100 untuk mengurutkan — bukan probabilitas. */
  risiko: number;
}

export type JenisPosisi = "BERSEBELAHAN" | "DEPAN_BELAKANG" | "DIAGONAL" | "SERUANG";
export const LABEL_POSISI: Record<JenisPosisi, string> = {
  BERSEBELAHAN: "Bersebelahan", DEPAN_BELAKANG: "Depan-belakang", DIAGONAL: "Diagonal", SERUANG: "Satu ruang",
};

export interface SiswaCepat { nama: string; nis: string; kelas: string | null; durasiMenit: number; medianMenit: number; detikPerSoal: number | null; nilai: number | null; alasan: string }

export interface HasilKemiripan {
  pasangan: PasanganMirip[];
  diperiksa: number;
  butirDibandingkan: number;
  adaDenah: boolean;
  cepat: SiswaCepat[];
  /** Ambang yang dipakai — ditampilkan supaya angkanya bisa ditafsirkan, bukan angka gaib. */
  ambang: { salahSamaMin: number; indeksMin: number };
}

const SALAH_SAMA_MIN = 4;
const INDEKS_MIN = 0.6;
/** Pasangan yang duduk berdekatan / pola waktunya sangat mirip: ambang sedikit lebih longgar. */
const SALAH_SAMA_MIN_DEKAT = 3;
const INDEKS_MIN_DEKAT = 0.5;
const BOBOT_POSISI: Record<JenisPosisi, number> = { BERSEBELAHAN: 25, DEPAN_BELAKANG: 20, DIAGONAL: 12, SERUANG: 4 };

/** Korelasi Pearson pada log(1+detik) — mengurangi pengaruh satu soal yang ditinggal lama. */
function korelasi(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 8) return null;
  const x = a.map(v => Math.log1p(v)), y = b.map(v => Math.log1p(v));
  const mx = x.reduce((p, q) => p + q, 0) / n, my = y.reduce((p, q) => p + q, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : null;
}

/** Posisi dua kursi dalam satu ruang & sesi. Kursi bernomor berurutan per baris selebar `kolom` meja. */
function posisiKursi(a: { ruangId: string; sesi: number; kursi: number; kolom: number }, b: { ruangId: string; sesi: number; kursi: number }): JenisPosisi | null {
  if (a.ruangId !== b.ruangId || a.sesi !== b.sesi) return null;
  const k = Math.max(1, a.kolom);
  const ra = Math.floor((a.kursi - 1) / k), ca = (a.kursi - 1) % k, rb = Math.floor((b.kursi - 1) / k), cb = (b.kursi - 1) % k;
  const dr = Math.abs(ra - rb), dc = Math.abs(ca - cb);
  if (dr === 0 && dc === 1) return "BERSEBELAHAN";
  if (dr === 1 && dc === 0) return "DEPAN_BELAKANG";
  if (dr === 1 && dc === 1) return "DIAGONAL";
  return "SERUANG";
}

/** Bandingkan seluruh pengerjaan yang sudah dikumpulkan pada satu ujian. */
export async function cariKemiripan(examId: string): Promise<HasilKemiripan> {
  const [soal, attempts, exam] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" }, select: { id: true, order: true, tipe: true, skor: true } }),
    prisma.examAttempt.findMany({
      where: { examId, submittedAt: { not: null } },
      select: {
        id: true, answers: true, skorButir: true, waktuSoal: true, startedAt: true, submittedAt: true, score: true, studentId: true,
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
      },
    }),
    prisma.exam.findUnique({ where: { id: examId }, select: { kegiatanId: true } }),
  ]);
  // Tempat duduk dari Denah Ruang kegiatan ini (bila ada).
  const kursi = exam?.kegiatanId
    ? await prisma.penempatanRuangUjian.findMany({
        where: { kegiatanId: exam.kegiatanId, studentId: { in: attempts.map(a => a.studentId) } },
        select: { studentId: true, ruangId: true, sesi: true, kursi: true, ruang: { select: { nama: true, kolom: true } } },
      })
    : [];
  const kursiSiswa = new Map(kursi.map(k => [k.studentId, { ruangId: k.ruangId, sesi: k.sesi, kursi: k.kursi, kolom: k.ruang.kolom, ruang: k.ruang.nama }]));

  // Hanya butir yang dinilai otomatis — uraian/unggah tidak punya "jawaban sama" yang bermakna.
  // Titik/letak pada gambar berupa koordinat bebas — tidak pernah "sama persis", jadi tidak dibandingkan.
  const butir = soal.filter(q => !butuhKoreksi(q.tipe) && q.tipe !== "TITIK_GAMBAR" && q.tipe !== "SERET_LEPAS");
  const urutBermakna = new Set(soal.filter(q => q.tipe === "URUTKAN").map(q => q.id));
  const nomorDari = new Map(butir.map(q => [q.id, q.order + 1]));
  const skorMaks = new Map(butir.map(q => [q.id, q.skor]));

  type Baris = {
    id: string; nama: string; nis: string; kelas: string | null; jawab: Map<string, string>; benar: Set<string>;
    waktu: Record<string, number>; studentId: string;
  };
  const baris: Baris[] = attempts.map(a => {
    const jawaban = (a.answers as Record<string, Jawaban>) ?? {};
    const skor = (a.skorButir as Record<string, number | null>) ?? {};
    const jawab = new Map<string, string>();
    const benar = new Set<string>();
    for (const q of butir) {
      const j = jawaban[q.id];
      if (j === null || j === undefined || j === "") continue;
      // Bentuk jawaban berbeda per tipe (string, array, objek) — dibakukan jadi teks supaya
      // bisa dibandingkan apa adanya. Urutan array dinormalkan agar "A,B" = "B,A".
      // URUTKAN: urutan justru jawabannya — jangan disortir (semua siswa punya himpunan langkah yang sama).
      const kunciJawab = Array.isArray(j) ? (urutBermakna.has(q.id) ? j.map(String) : [...j].map(String).sort()).join("|")
        : typeof j === "object" ? JSON.stringify(Object.entries(j as Record<string, unknown>).sort())
        : String(j);
      if (!kunciJawab) continue;
      jawab.set(q.id, kunciJawab);
      const s = skor[q.id];
      if (typeof s === "number" && s >= (skorMaks.get(q.id) ?? 0)) benar.add(q.id);
    }
    return {
      id: a.id, nama: a.student.user.name, nis: a.student.nis, kelas: a.student.class?.name ?? null, jawab, benar,
      waktu: (a.waktuSoal as Record<string, number>) ?? {}, studentId: a.studentId,
    };
  });

  const pasangan: PasanganMirip[] = [];
  for (let i = 0; i < baris.length; i++) {
    for (let k = i + 1; k < baris.length; k++) {
      const x = baris[i], y = baris[k];
      let bersama = 0, salahBersama = 0, salahSama = 0;
      const nomor: number[] = [];
      for (const [qid, jx] of x.jawab) {
        const jy = y.jawab.get(qid);
        if (jy === undefined) continue;
        bersama++;
        if (x.benar.has(qid) || y.benar.has(qid)) continue; // cukup satu benar → bukan sinyal
        salahBersama++;
        if (jx === jy) { salahSama++; nomor.push(nomorDari.get(qid) ?? 0); }
      }
      if (salahBersama === 0) continue;
      const indeks = salahSama / salahBersama;
      if (salahSama < SALAH_SAMA_MIN_DEKAT || indeks < INDEKS_MIN_DEKAT) continue;

      const kx = kursiSiswa.get(x.studentId), ky = kursiSiswa.get(y.studentId);
      const jenis = kx && ky ? posisiKursi(kx, ky) : null;
      const tx: number[] = [], ty: number[] = [];
      for (const q of soal) { const a1 = x.waktu[q.id] ?? 0, b1 = y.waktu[q.id] ?? 0; if (a1 > 0 && b1 > 0) { tx.push(a1); ty.push(b1); } }
      const r = korelasi(tx, ty);
      const dekat = jenis === "BERSEBELAHAN" || jenis === "DEPAN_BELAKANG" || jenis === "DIAGONAL" || (r !== null && r >= 0.9);
      if (!dekat && (salahSama < SALAH_SAMA_MIN || indeks < INDEKS_MIN)) continue;

      const dasar = Math.min(55, salahSama * 7) * Math.min(1, indeks / 0.8);
      const bonusWaktu = r === null ? 0 : r >= 0.9 ? 20 : r >= 0.8 ? 12 : r >= 0.7 ? 6 : 0;
      pasangan.push({
        a: { attemptId: x.id, nama: x.nama, nis: x.nis, kelas: x.kelas },
        b: { attemptId: y.id, nama: y.nama, nis: y.nis, kelas: y.kelas },
        bersama, salahBersama, salahSama, indeks, nomor: nomor.sort((p, q) => p - q),
        posisi: jenis && kx && ky ? { jenis, ruang: kx.ruang, sesi: kx.sesi, kursiA: kx.kursi, kursiB: ky.kursi } : null,
        korelasiWaktu: r,
        risiko: Math.min(100, Math.round(dasar + (jenis ? BOBOT_POSISI[jenis] : 0) + bonusWaktu)),
      });
    }
  }
  pasangan.sort((p, q) => q.risiko - p.risiko || q.salahSama - p.salahSama);

  // Siswa yang selesai jauh lebih cepat dari median teman-temannya, atau rata-rata sangat singkat per soal.
  const durasi = attempts.map(a => (a.submittedAt!.getTime() - a.startedAt.getTime()) / 60_000).filter(m => m > 0);
  const median = durasi.length ? [...durasi].sort((p, q) => p - q)[Math.floor(durasi.length / 2)] : 0;
  const cepat: SiswaCepat[] = [];
  if (attempts.length >= 5 && median >= 5) {
    for (const a of attempts) {
      const menit = (a.submittedAt!.getTime() - a.startedAt.getTime()) / 60_000;
      const w = Object.values((a.waktuSoal as Record<string, number>) ?? {}).filter(v => v > 0);
      const dps = w.length >= 5 ? Math.round(w.reduce((p, q) => p + q, 0) / w.length) : null;
      const alasan = [menit < median * 0.35 ? `selesai ${Math.round(menit)} menit (median kelas ${Math.round(median)} menit)` : "", dps !== null && dps < 6 ? `rata-rata ${dps} detik per soal` : ""].filter(Boolean);
      if (alasan.length) {
        cepat.push({
          nama: a.student.user.name, nis: a.student.nis, kelas: a.student.class?.name ?? null,
          durasiMenit: Math.round(menit * 10) / 10, medianMenit: Math.round(median * 10) / 10, detikPerSoal: dps, nilai: a.score, alasan: alasan.join(" · "),
        });
      }
    }
    cepat.sort((p, q) => p.durasiMenit - q.durasiMenit);
  }
  return {
    pasangan: pasangan.slice(0, 50),
    diperiksa: baris.length,
    butirDibandingkan: butir.length,
    adaDenah: kursi.length > 0,
    cepat: cepat.slice(0, 30),
    ambang: { salahSamaMin: SALAH_SAMA_MIN, indeksMin: INDEKS_MIN },
  };
}
