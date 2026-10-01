/** Netral (boleh dipakai komponen klien) — TIDAK `server-only`.
 *
 * Satu HP, dua jenis QR. QR absensi gerbang/kelas berisi TOKEN pendek (src/lib/absensi-qr.ts),
 * sedangkan QR presensi kegiatan berisi ALAMAT `…/hadir/<id>?t=<token>`. Layar Absen Mandiri dulu
 * mengirim apa pun yang terpindai ke endpoint absensi gerbang, sehingga QR kegiatan ditolak dengan
 * pesan tentang gerbang dan tidak ada seorang pun bisa absen di kegiatan (laporan user 1 Oktober 2026).
 *
 * Alamat sengaja dikembalikan RELATIF terhadap origin yang sedang dibuka: QR bisa saja memuat alamat
 * terowongan lama (ts.net) sementara penggunanya sedang masuk lewat domain sekolah — mengikuti alamat
 * absolutnya akan melempar mereka ke origin tempat sesinya tidak berlaku.
 */
export function jalurHadirKegiatan(teks: string): string | null {
  const t = (teks ?? "").trim();
  if (!t) return null;
  let jalur: string, cari: string;
  try {
    // `base` dipakai kalau QR berisi jalur relatif; untuk URL absolut, base diabaikan.
    const u = new URL(t, "http://x.invalid");
    jalur = u.pathname;
    cari = u.searchParams.get("t") ?? "";
  } catch {
    return null;
  }
  const m = /^\/hadir\/([A-Za-z0-9_-]{1,40})$/.exec(jalur);
  if (!m) return null;
  if (!/^\d{1,12}\.[A-Za-z0-9_-]{1,32}$/.test(cari)) return null;
  return `/hadir/${m[1]}?t=${encodeURIComponent(cari)}`;
}
