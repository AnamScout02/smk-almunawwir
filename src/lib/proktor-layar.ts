import "server-only";

/** LAYAR PROKTOR (5 Oktober 2026) — padanan Proktor Browser ANBK: aplikasi MyAlwis Ujian Windows mengirim potret
 *  JENDELA UJIANNYA SENDIRI tiap ±10 detik selama mode ujian, pengawas melihat semua layar dalam satu kisi di Papan
 *  Pantau.
 *
 *  Yang dijaga dan alasannya:
 *  - HANYA DI MEMORI, satu potret terakhir per peserta, kedaluwarsa 2 menit. Tidak pernah ditulis ke disk / DB —
 *    ini alat mengawasi ruang ujian saat itu juga, bukan arsip rekaman siswa.
 *  - Yang dipotret jendela ujian, BUKAN seluruh desktop. Selain lebih menjaga privasi, potret desktop justru akan
 *    hitam karena jendela ujian memakai setContentProtection (mencegah siswa memotret soal).
 *  - Peserta diberi tahu: aplikasi menampilkan penanda "Layar dipantau pengawas" selama mode ujian.
 *  - Satu proses Node (globalThis), pola sama dengan sinyal-ujian.ts. */
export type Cuplikan = { jpeg: Buffer; waktu: number; fokus: boolean };

const KEDALUWARSA_MS = 2 * 60_000;
const g = globalThis as unknown as { __proktorLayar?: Map<string, Map<string, Cuplikan>> };
const peta = (g.__proktorLayar ??= new Map());

export function simpanCuplikan(examId: string, studentId: string, c: Cuplikan) {
  let m = peta.get(examId);
  if (!m) { m = new Map(); peta.set(examId, m); }
  m.set(studentId, c);
}

/** Cuplikan hidup satu ujian; yang kedaluwarsa dibuang sekalian. */
export function cuplikanUjian(examId: string): Map<string, Cuplikan> {
  const m = peta.get(examId);
  if (!m) return new Map();
  const batas = Date.now() - KEDALUWARSA_MS;
  for (const [k, v] of m) if (v.waktu < batas) m.delete(k);
  if (!m.size) peta.delete(examId);
  return m;
}

/** Jarak minimum antar-kiriman per peserta — aplikasi yang salah setel tidak boleh membanjiri server. */
export const JEDA_MIN_MS = 4_000;
export const UKURAN_MAKS = 250 * 1024;
