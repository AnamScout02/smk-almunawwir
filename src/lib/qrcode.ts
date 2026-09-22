import "server-only";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

/** Buat QR code sebagai data URI PNG — dipakai langsung di <img src=...> pada halaman cetak. */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: "#0F1A45", light: "#FFFFFF" } });
}

let logoBase64Cache: string | null = null;
/** Logo yang ditempel di tengah QR WAJIB versi kecil (logo-emblem-qr.png, 72x72 ~4 KB), BUKAN
 * logo-emblem.png yang 512x512 ~157 KB. Logo ini di-base64 ke DALAM setiap SVG QR, jadi ukurannya
 * terkali jumlah QR yang dibuat: dengan logo besar, endpoint Kartu Tanda satu kelas penuh
 * mengirim 93 MB untuk 317 siswa (terukur 2026-09-12) — dengan logo kecil jadi ~3 MB. Saat
 * dicetak logo ini cuma beberapa milimeter, 72px sudah lebih dari cukup.
 * Kalau logo sekolah diganti, ganti JUGA berkas -qr.png-nya (kecilkan dulu), jangan arahkan
 * balik ke logo besar. */
function getLogoBase64(): string {
  if (logoBase64Cache) return logoBase64Cache;
  const buf = fs.readFileSync(path.join(process.cwd(), "public/images/logo-emblem-qr.png"));
  logoBase64Cache = `data:image/png;base64,${buf.toString("base64")}`;
  return logoBase64Cache;
}

/** Sama seperti `generateQrDataUrl`, TAPI dengan logo emblem sekolah ditempel di tengah QR — dipakai
 * khusus utk barcode buku perpustakaan (satu-satunya kebutuhan yang eksplisit minta logo di tengah;
 * QR verifikasi/QR peminjam TIDAK diubah, sengaja tetap polos). Pakai `errorCorrectionLevel: "H"`
 * (tahan sampai ~30% area tertutup) karena logo menutupi bagian tengah QR — margin aman standar
 * industri utk ukuran logo ~22% dari total lebar QR (di bawah itu masih ke-scan lancar oleh scanner
 * biasa). Logo digambar sebagai elemen SVG (bukan komposit canvas) supaya tidak butuh native
 * dependency (`node-canvas`) yang berat di-install di Docker.
 */
export async function generateQrWithLogoDataUrl(text: string): Promise<string> {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const margin = 1;
  const total = qr.modules.size + margin * 2;

  const svgBody = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "H", margin, color: { dark: "#0F1A45", light: "#FFFFFF" } });

  const logoRatio = 0.22;
  const logoSize = total * logoRatio;
  const logoPos = (total - logoSize) / 2;
  const padPos = logoPos - logoSize * 0.08;
  const padSize = logoSize * 1.16;

  const logoElements = `
    <rect x="${padPos}" y="${padPos}" width="${padSize}" height="${padSize}" rx="${padSize * 0.18}" fill="#FFFFFF" />
    <image x="${logoPos}" y="${logoPos}" width="${logoSize}" height="${logoSize}" href="${getLogoBase64()}" preserveAspectRatio="xMidYMid meet" />
  `;
  const svgWithLogo = svgBody.replace("</svg>", `${logoElements}</svg>`);

  return `data:image/svg+xml;base64,${Buffer.from(svgWithLogo).toString("base64")}`;
}
