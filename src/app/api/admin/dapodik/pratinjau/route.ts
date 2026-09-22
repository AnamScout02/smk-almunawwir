import { verifyDapodikAccess } from "@/lib/dapodik-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { ambilLangkahDapodik, bandingkanDapodik } from "@/lib/dapodik-sinkron";

export const dynamic = "force-dynamic";

/** PRATINJAU SINKRON — baca-saja: bandingkan Dapodik dengan data TU (acuan). Tidak menulis apa pun, ke mana pun.
 * Dibatasi 6 kali per menit untuk seluruh sekolah supaya Web Service Dapodik tidak terbebani. */
export async function GET(req: Request) {
  await verifyDapodikAccess();
  if (!checkRateLimit("dapodik-pratinjau", 12, 60_000)) {
    return Response.json({ error: "Pratinjau dibatasi — tunggu sebentar lalu coba lagi." }, { status: 429 });
  }
  // `?langkah=pd|gtk|rombel` mengambil SATU daftar saja (±15 detik) lalu menyinggahkannya, supaya
  // tiap permintaan HTTP tetap pendek dan tidak kena batas tunggu proxy — dulu satu permintaan
  // panjang (20–47 detik) sesekali dibalas 502 (laporan user 20 September 2026).
  const langkah = new URL(req.url).searchParams.get("langkah");
  if (langkah) {
    const h = await ambilLangkahDapodik(langkah, new URL(req.url).searchParams.get("segar") === "1");
    if (!h.ok) return Response.json({ error: `Data Dapodik gagal diambil — ${h.pesan}` }, { status: 502 });
    return Response.json({ langkah, jumlah: h.jumlah }, { headers: { "Cache-Control": "no-store" } });
  }
  const h = await bandingkanDapodik();
  if (!h.ok) return Response.json({ error: `Data Dapodik gagal diambil — ${h.pesan}` }, { status: 502 });
  return Response.json(h.data, { headers: { "Cache-Control": "no-store" } });
}
