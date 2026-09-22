/** Salin teks ke clipboard — JUGA di situs yang dibuka lewat HTTP.
 *
 * `navigator.clipboard` hanya tersedia di "secure context" (HTTPS atau localhost). Server sekolah
 * masih dibuka lewat http://<IP-PUBLIK-SERVER>:3000, jadi di sana `navigator.clipboard` tidak ada:
 * pola lama `navigator.clipboard?.writeText(...)` gagal DIAM-DIAM sementara notifikasi "disalin"
 * tetap muncul — token terlihat tersalin padahal saat ditempel kosong (temuan user 14 Sep 2026).
 *
 * Urutan: Clipboard API bila tersedia → cadangan textarea tersembunyi + execCommand("copy").
 * Mengembalikan `true` HANYA kalau teks benar-benar tersalin; pemanggil wajib memakai hasil ini
 * untuk menentukan notifikasi berhasil/gagal. Hanya untuk dipanggil dari klik pengguna. */
export async function salinTeks(teks: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* ditolak browser — lanjut ke cara cadangan */
  }
  try {
    const sebelumnya = document.activeElement as HTMLElement | null;
    const ta = document.createElement("textarea");
    ta.value = teks;
    ta.setAttribute("readonly", "");
    // Pola clipboard.js: readonly + select + setSelectionRange (juga jalan di iPhone/iPad);
    // font 12pt supaya iOS tidak memperbesar layar saat textarea difokuskan sesaat.
    Object.assign(ta.style, {
      position: "fixed", top: "0", left: "-9999px", fontSize: "12pt", border: "0", padding: "0", margin: "0",
    });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, teks.length);
    const berhasil = document.execCommand("copy");
    document.body.removeChild(ta);
    sebelumnya?.focus?.();
    return berhasil;
  } catch {
    return false;
  }
}
