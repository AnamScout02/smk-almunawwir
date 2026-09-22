/** Ringkas User-Agent jadi label yang dipahami orang awam ("Chrome · Windows"). Sengaja sederhana:
 * cukup untuk mengenali "itu laptop saya / itu HP siapa", bukan deteksi perangkat yang presisi. */
export function ringkasPerangkat(ua: string | null | undefined): { label: string; seluler: boolean } {
  if (!ua) return { label: "Perangkat tidak dikenal", seluler: false };
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return { label: os ? `${browser} · ${os}` : browser, seluler: /Mobile|Android|iPhone|iPad/.test(ua) };
}
