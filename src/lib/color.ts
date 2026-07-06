function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(n => n.toString(16).padStart(2, "0")).join("");
}

function shade(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/** Gradien CSS "to bottom right" dari satu warna dasar (lebih terang -> dasar -> lebih gelap). */
export function themeGradient(hex: string): string {
  const light = shade(hex, 0.18);
  const dark = shade(hex, -0.22);
  return `linear-gradient(to bottom right, ${light}, ${hex} 55%, ${dark})`;
}

/** Gradien CSS "to right" untuk elemen kecil (badge, tombol). */
export function themeGradientRight(hex: string): string {
  const light = shade(hex, 0.12);
  const dark = shade(hex, -0.15);
  return `linear-gradient(to right, ${light}, ${dark})`;
}

/** Tambahkan alpha (0-100) ke warna hex, mis. withAlpha("#1B2B6B", 10) -> "#1B2B6B1A". */
export function withAlpha(hex: string, percent: number): string {
  const alphaHex = Math.round((percent / 100) * 255).toString(16).padStart(2, "0");
  return `${hex}${alphaHex}`;
}
