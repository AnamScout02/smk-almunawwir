/** CAP FOTO (9 Okt 2026) — menulis waktu, lokasi, dan nama di pita bawah foto, di PERAMBAN, sebelum diunggah.
 *  Cap ini untuk DIBACA orang (guru, pembimbing industri); yang menjadi pegangan sistem tetap waktu server dan
 *  tanda dari /api/student/pkl/foto (src/lib/pkl-foto.ts), bukan tulisan di gambar. */
export function capFoto(kanvas: HTMLCanvasElement, baris: string[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = kanvas.width; c.height = kanvas.height;
  const ctx = c.getContext("2d");
  if (!ctx) return kanvas;
  ctx.drawImage(kanvas, 0, 0);
  const teks = baris.filter(Boolean);
  if (!teks.length) return c;
  const huruf = Math.max(14, Math.round(Math.min(c.width, c.height) * 0.032));
  const jarak = Math.round(huruf * 1.35), tepi = Math.round(huruf * 0.8);
  const tinggi = teks.length * jarak + tepi * 2;
  const g = ctx.createLinearGradient(0, c.height - tinggi * 1.4, 0, c.height);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = g;
  ctx.fillRect(0, c.height - tinggi * 1.4, c.width, tinggi * 1.4);
  ctx.font = `600 ${huruf}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 4;
  teks.forEach((t, i) => {
    // Baris yang terlalu panjang dipendekkan supaya tidak terpotong tepi foto.
    let s = t;
    while (s.length > 8 && ctx.measureText(s).width > c.width - tepi * 2) s = s.slice(0, -2);
    ctx.fillText(s === t ? s : s + "…", tepi, c.height - tinggi + tepi + i * jarak);
  });
  return c;
}

export const waktuCap = (d = new Date()) =>
  d.toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
