/** APLIKASI **MyAlwis Mobile** (Android, 22–23 September 2026) — satu aplikasi untuk seluruh portal (siswa, guru, orang tua, TU);
 * HANYA saat halaman pengerjaan ujian terbuka aplikasi berganti ke MODE UJIAN (pengganti Exambro): layar disematkan, tangkapan
 * layar diblokir, keluar butuh PIN pengawas (`ujian.pinAplikasi`). Halaman ujian memberi tahu lewat `window.AplikasiSMK.modeUjian()`.
 * Sumber aplikasi: android-ujian/ (APK di public/unduh, tidak masuk git). Murni — klien & server.
 *
 * Nama dipilih user 23 September 2026 ("Alwis" = julukan sekolah): "MyAlwis Mobile", label pendek "MyAlwis" supaya tidak
 * terpotong di layar utama HP. Penanda lama tetap dikenali supaya aplikasi yang sudah terpasang tidak ikut rusak. */
export const NAMA_APLIKASI = "MyAlwis Mobile";
export const NAMA_PENDEK = "MyAlwis";
export const PENANDA_APLIKASI = "MyAlwisMobile"; // ditambahkan aplikasi ke User-Agent: "… MyAlwisMobile/2.2"
/** Penanda versi lama: 2.0 (nama Aplikasi SMK Al-Munawwir) & 1.0 (khusus ujian). */
const PENANDA_LAMA = ["SMKAlMunawwirApp", "SMKUjianApp"];
export const VERSI_APLIKASI = "2.3";
export const BERKAS_APK = "/unduh/myalwis-mobile.apk";
/** Satu halaman untuk aplikasi Android MAUPUN pemasangan dari browser (23 Sep 2026: /aplikasi & /pasang-aplikasi digabung). */
export const HALAMAN_APLIKASI = "/pasang-aplikasi";

export const lewatAplikasi = (ua: string | null | undefined) => {
  const s = ua ?? "";
  return s.includes(PENANDA_APLIKASI) || PENANDA_LAMA.some(p => s.includes(p));
};
export const hpAndroid = (ua: string | null | undefined) => /Android/i.test(ua ?? "");

/** Pesan penolakan untuk ujian ber-`wajibAplikasi` (hanya HP Android di luar aplikasi; komputer & iPhone lolos). */
export function tolakTanpaAplikasi(ua: string | null | undefined): string | null {
  if (!hpAndroid(ua) || lewatAplikasi(ua)) return null;
  return `Ujian ini wajib dikerjakan lewat aplikasi ${NAMA_APLIKASI} di HP Android (layar terkunci otomatis saat ujian). Unduh aplikasinya dari kartu "Unduh Aplikasi" di beranda ujian, masuk, lalu masukkan token lagi.`;
}
