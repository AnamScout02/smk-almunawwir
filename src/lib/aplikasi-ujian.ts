/** APLIKASI UJIAN ANDROID (22 September 2026) — pengganti Exambro: WebView ke portal ujian + layar disematkan (tombol Home &
 * aplikasi lain terkunci), tangkapan layar diblokir, keluar saat mengerjakan butuh PIN pengawas (`ujian.pinAplikasi`). Kode
 * aplikasinya di luar repo (scratchpad android-ujian), APK di public/unduh. Murni — klien & server. */
export const PENANDA_APLIKASI = "SMKUjianApp"; // ditambahkan aplikasi ke User-Agent: "… SMKUjianApp/1.0"
export const VERSI_APLIKASI = "1.0";
export const BERKAS_APK = "/unduh/aplikasi-ujian-smk.apk";
export const HALAMAN_APLIKASI = "/aplikasi-ujian";

export const lewatAplikasi = (ua: string | null | undefined) => (ua ?? "").includes(PENANDA_APLIKASI);
export const hpAndroid = (ua: string | null | undefined) => /Android/i.test(ua ?? "");

/** Pesan penolakan untuk ujian ber-`wajibAplikasi` (hanya HP Android di luar aplikasi; komputer & iPhone lolos). */
export function tolakTanpaAplikasi(ua: string | null | undefined): string | null {
  if (!hpAndroid(ua) || lewatAplikasi(ua)) return null;
  return "Ujian ini wajib dikerjakan lewat Aplikasi Ujian SMK di HP Android. Unduh aplikasinya di halaman \"Aplikasi Ujian\" (menu Unduh Aplikasi di beranda ujian), lalu masuk dan masukkan token lagi.";
}
