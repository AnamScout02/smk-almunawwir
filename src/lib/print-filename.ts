/** Bangun nama file yang deskriptif untuk halaman cetak (dipakai sebagai `document.title`/
 * `metadata.title` — browser memakai judul tab sebagai nama file default saat "Simpan sebagai
 * PDF"). Sebelum ini SEMUA halaman cetak menampilkan "SMK Al Munawwir IIBS" polos (judul default
 * root layout), jadi hasil PDF-nya semuanya bernama sama persis — dilaporkan user 2026-08-20.
 *
 * Isomorphic (TIDAK ada "use client"/"server-only") — dipakai dari generateMetadata() Server
 * Component MAUPUN dari usePrintTitle() Client Component (lihat file itu). */

/** Bersihkan satu bagian nama (nama siswa, nomor surat, dll) dari karakter yang bikin nama file
 * rusak — terutama "/" (nomor surat sekolah SERING mengandung ini, mis. "359/B.2/SMK_AM-IIBS/026/VII/2026")
 * yang kalau dibiarkan akan terbaca sebagai pemisah folder. */
export function sanitizeFilenamePart(raw: string): string {
  return raw
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_.-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
}

/** `buildPrintFilename("BUKU_INDUK", student.user.name, student.nis)` → "BUKU_INDUK_Ahmad-Fauzi_2024001".
 * Bagian yang kosong/null/undefined otomatis dilewati (bukan jadi underscore ganda). */
export function buildPrintFilename(prefix: string, ...parts: (string | number | null | undefined)[]): string {
  const clean = parts
    .filter((p): p is string | number => p !== null && p !== undefined && String(p).trim() !== "")
    .map(p => sanitizeFilenamePart(String(p)));
  return [prefix, ...clean].join("_");
}
