// Palet warna tetap per kode singkat guru — persis sesuai referensi warna yang sudah dipakai
// (A..Z, AA..AI), supaya warnanya konsisten dengan sistem manual yang sudah ada, bukan dihitung
// dari rumus. Kalau kode guru lebih banyak dari daftar ini, fallback ke rumus golden-angle biar
// tetap dapat warna unik. Dipakai baik di client (tabel live) maupun server (ekspor Excel).
export const TEACHER_CODE_HEX: Record<string, string> = {
  A: "#79C9E8", B: "#4D4D4D", C: "#F5F58C", D: "#3FC7C0", E: "#1C4FD6",
  F: "#B39DDD", G: "#2FA84C", H: "#F0A868", I: "#29D9CE", J: "#EA1E88",
  K: "#7A1D3C", L: "#C06A1E", M: "#7C90B8", N: "#16204A", O: "#F8DADA",
  P: "#4A1258", Q: "#9B9B9B", R: "#E8AE72", S: "#E048E8", T: "#C7CC22",
  U: "#E67A1E", V: "#5C0E2E", W: "#A34E70", X: "#0F2A16", Y: "#0A0A0A",
  Z: "#8814D6", AA: "#E0501E", AB: "#CCF0A8", AC: "#1E2C6E", AD: "#0E6E6C",
  AE: "#2C4A1C", AF: "#E8D02A", AG: "#C81E7C", AH: "#C22C14", AI: "#4E6C78",
};

function shortCodeToIndex(code: string): number {
  let n = 0;
  let hasLetter = false;
  for (const ch of code.toUpperCase()) {
    if (ch < "A" || ch > "Z") continue;
    hasLetter = true;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return hasLetter ? n - 1 : -1;
}

export function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export function colorForTeacherCode(code: string): { bg: string; text: string } {
  const upper = code.toUpperCase();
  const fixed = TEACHER_CODE_HEX[upper];
  if (fixed) return { bg: fixed, text: textColorFor(fixed) };
  const idx = shortCodeToIndex(code);
  if (idx < 0) return { bg: "#e5e7eb", text: "#374151" };
  const hue = (idx * 137.508) % 360;
  return { bg: hslToHex(hue, 68, 87), text: hslToHex(hue, 65, 27) };
}
