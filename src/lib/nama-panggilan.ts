/** NAMA PANGGILAN untuk layar umum (papan peringkat, papan kesiswaan) — antrean butir 30.
 *
 * Nama lengkap siswa/guru sering panjang ("M. Rizky Maulana") sehingga di kartu peringkat yang sempit
 * terpotong `truncate` di tengah kata. Di layar yang dilihat banyak orang, nama pendek yang UTUH lebih
 * terbaca daripada nama panjang yang terpenggal: "M. Rizky Maulana" → "Rizky M.".
 *
 * Aturannya sengaja sederhana dan bisa diramal:
 * - Gelar di belakang koma dibuang ("Budi Santoso, S.Pd." → "Budi Santoso").
 * - Kata pembuka yang bukan nama panggilan dilewati: inisial berteks pendek/bertitik (M., Moh, Muh),
 *   gelar depan (Drs, Dra, Ir), dan sapaan (H, Hj, KH, Ust) — "M. Rizky Maulana" dipanggil "Rizky".
 * - Kata terakhir yang berbeda dijadikan inisial supaya dua siswa bernama depan sama tetap terbeda.
 *
 * DIPAKAI HANYA UNTUK TAMPILAN LAYAR UMUM. Dokumen resmi (rapor, nominatif, ijazah, presensi, sertifikat)
 * dan daftar kerja (tabel siswa, absensi, DKN) WAJIB tetap memakai nama lengkap apa adanya. */

const LEWATI = new Set([
  "m", "moh", "mohd", "mhd", "muh", "muhd", "mochamad", "mochammad",
  "drs", "dra", "ir", "h", "hj", "kh", "ny", "tn", "ust", "ustadz", "ustadzah", "a", "r", "st",
]);

const bersih = (k: string) => k.replace(/[.,]/g, "").toLowerCase();

/** Nama pendek untuk layar umum. Mengembalikan nama aslinya bila tidak ada yang bisa dipendekkan. */
export function namaPanggilan(nama: string | null | undefined): string {
  const penuh = String(nama ?? "").split(",")[0].trim().replace(/\s+/g, " ");
  if (!penuh) return "";
  const kata = penuh.split(" ");
  if (kata.length === 1) return penuh;

  // Kata pertama yang benar-benar nama panggilan (bukan inisial/gelar/sapaan).
  let i = 0;
  while (i < kata.length - 1 && (LEWATI.has(bersih(kata[i])) || bersih(kata[i]).length <= 1)) i += 1;
  const depan = kata[i];

  const belakang = kata[kata.length - 1];
  if (belakang === depan) return depan;
  const awal = bersih(belakang).charAt(0).toUpperCase();
  return awal ? `${depan} ${awal}.` : depan;
}
