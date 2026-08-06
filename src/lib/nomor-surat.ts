const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Format baku sekolah: 359/B.2/SMK_AM-IIBS/026/VII/2026
// (urut/klasifikasi/nama sekolah/kode sekolah/bulan romawi/tahun)
export function formatNomorSurat(urut: number, klasifikasi: string, kodeSekolah: string, date: Date): string {
  const urutStr = String(urut).padStart(3, "0");
  const bulanRomawi = ROMAN_MONTHS[date.getMonth()];
  const tahun = date.getFullYear();
  return `${urutStr}/${klasifikasi}/SMK_AM-IIBS/${kodeSekolah}/${bulanRomawi}/${tahun}`;
}

// Ambil nomor urut (angka di depan sebelum "/" pertama) dari string nomor surat — dipakai untuk
// melanjutkan urutan dari surat yang sudah pernah dibuat (termasuk yang diimpor dari catatan manual),
// bukan menghitung jumlah baris di database (karena baris impor tidak selalu 1:1 dengan urutan asli).
export function parseNomorUrut(nomor: string): number {
  const match = nomor.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
