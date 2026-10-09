import "server-only";
import { olahGambarTtd } from "@/lib/ttd";

/** Baca TTD dari permintaan: multipart `file` (foto/scan) ATAU JSON `{ gambar: "data:image/png;base64,…" }` dari kanvas
 *  gambar-di-layar. Batas 6 MB. Mengembalikan PNG siap simpan atau pesan galat. */
export async function ttdDariPermintaan(req: Request): Promise<{ png: Buffer; isian: Record<string, string> } | { galat: string }> {
  let mentah: Buffer | null = null;
  // Isian teks lain yang ikut terkirim (mis. nama & hubungan penanda tangan pakta SPMB), maks 200 huruf per isian.
  const isian: Record<string, string> = {};
  const catat = (k: string, v: unknown) => { if (typeof v === "string" && k !== "gambar") isian[k] = v.slice(0, 200); };
  const jenis = req.headers.get("content-type") ?? "";
  if (jenis.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    fd?.forEach((v, k) => catat(k, v));
    const f = fd?.get("file");
    if (!(f instanceof File) || !f.size) return { galat: "Pilih gambar tanda tangan." };
    if (!/^image\/(png|jpe?g|webp|heic|heif)$/.test(f.type)) return { galat: "Gunakan gambar JPG, PNG, atau WEBP." };
    if (f.size > 6 * 1024 * 1024) return { galat: "Ukuran gambar maksimal 6 MB." };
    mentah = Buffer.from(await f.arrayBuffer());
  } else {
    const b = await req.json().catch(() => ({}));
    for (const [k, v] of Object.entries(b ?? {})) catat(k, v);
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.gambar ?? ""));
    if (!m) return { galat: "Gambar tanda tangan tidak terbaca." };
    mentah = Buffer.from(m[2], "base64");
    if (mentah.length > 6 * 1024 * 1024) return { galat: "Gambar terlalu besar." };
  }
  const png = await olahGambarTtd(mentah);
  if (!png || png.length < 300) return { galat: "Tanda tangan kosong atau tidak terbaca — pastikan goresannya gelap di atas latar terang." };
  return { png, isian };
}
