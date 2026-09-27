/** TEKS TAMBAHAN WAKTU PENGAWAS (24 September 2026 — temuan user: "reset waktu tapi kok banyak sekali", +780').
 *
 * `ExamAttempt.tambahanMenit` BUKAN "waktu hadiah" yang diberikan pengawas, melainkan JARAK GESER tenggat
 * terhadap tenggat asli siswa itu (jam ia mulai + durasi, atau jam tutup ujian — mana yang lebih dulu).
 * "Reset Waktu" berarti "beri dia durasi penuh DARI SEKARANG", jadi bila siswa mulai kemarin malam lalu
 * waktunya direset pagi ini, gesernya wajar berjam-jam: kasus nyata +780 menit = 13 jam sejak ia mulai
 * (mulai 19.53, reset 08.53 — hitungannya benar, angkanya saja yang mengagetkan dalam satuan menit).
 *
 * Karena itu angka besar ditampilkan dalam JAM, dan disertai keterangan saat disorot. Murni teks — tidak
 * mengubah perhitungan tenggat sama sekali (lihat `tenggat` & `tambahanUntukSisa` di src/lib/ujian-server.ts). */
export function teksTambahanWaktu(menit: number): string {
  const m = Math.max(0, Math.round(menit));
  if (m < 60) return `+${m} mnt`;
  const jam = Math.floor(m / 60);
  const sisa = m % 60;
  return sisa ? `+${jam} j ${sisa} mnt` : `+${jam} jam`;
}

/** Keterangan lengkap untuk atribut `title` — supaya pengawas tahu angkanya dari mana. */
export function judulTambahanWaktu(menit: number): string {
  const m = Math.max(0, Math.round(menit));
  return `Tenggat siswa ini digeser ${m} menit oleh pengawas. Angka ini dihitung dari tenggat ASLINYA (jam ia mulai + durasi), jadi wajar besar bila waktunya direset lama setelah ia mulai — sisa waktu yang berlaku tetap yang tertera di sebelah kiri.`;
}
