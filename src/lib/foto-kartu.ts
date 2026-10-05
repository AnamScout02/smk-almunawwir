/** Foto pada Kartu Tanda (KTS) — SATU urutan untuk semua tempat yang mencetak kartu (4 Okt 2026, keputusan user):
 *  Foto Kartu (khusus KTS) → Foto Masuk (Buku Induk) → foto profil akun. Foto resmi didahulukan; foto profil
 *  yang diunggah sendiri hanya dipakai bila tidak ada foto lain. Netral (bukan server-only). */
export function fotoUntukKartu(bukuIndukData: unknown, avatar: string | null | undefined): string | null {
  const d = (bukuIndukData && typeof bukuIndukData === "object" ? bukuIndukData : {}) as Record<string, unknown>;
  const ambil = (k: string) => (typeof d[k] === "string" && d[k] ? (d[k] as string) : null);
  return ambil("fotoKartuUrl") ?? ambil("fotoMasukUrl") ?? (avatar || null);
}

/** Kunci pencocokan nama berkas ↔ NIS/NISN/NIP: huruf besar, tanpa tanda baca & spasi. */
export const kunciBerkas = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
