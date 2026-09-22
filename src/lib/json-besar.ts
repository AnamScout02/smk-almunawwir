import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const AMBANG = 24_000; // di bawah ini kompresi tidak sepadan dengan biayanya

/** JSON BESAR YANG DIKOMPRESI (18 September 2026).
 *
 * Next.js meng-gzip halaman HTML, TETAPI TIDAK respons route handler (`Response.json`) karena
 * bodinya berupa stream — terbukti dari header: `Transfer-Encoding: chunked` tanpa
 * `Content-Encoding`. Akibatnya daftar besar dikirim mentah: Kelola Siswa 1,3 MB dan Buku Induk
 * 3,7 MB, yang di HP lewat jaringan sekolah membuat halaman "muter-muter lama" (temuan user).
 *
 * Helper ini memampatkan bila klien menerima gzip dan isinya memang besar; selain itu jatuh ke
 * `Response.json` biasa. Pakai untuk endpoint yang mengembalikan DAFTAR PANJANG. */
export async function jsonBesar(data: unknown, req: Request, init?: ResponseInit): Promise<Response> {
  const teks = JSON.stringify(data);
  const terima = req.headers.get("accept-encoding") ?? "";
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (teks.length < AMBANG || !terima.includes("gzip")) {
    return new Response(teks, { ...init, headers });
  }
  const buf = await gzipAsync(teks);
  headers.set("content-encoding", "gzip");
  headers.set("content-length", String(buf.length));
  headers.set("vary", "accept-encoding");
  return new Response(new Uint8Array(buf), { ...init, headers });
}
