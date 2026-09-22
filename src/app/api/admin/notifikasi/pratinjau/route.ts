import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { jalankanPengingat } from "@/lib/pengingat-terjadwal";

export const dynamic = "force-dynamic";

/** PRATINJAU pengingat terjadwal: apa yang AKAN dikirim pada tanggal & jam WIB tertentu, TANPA mengirim.
 * `?waktu=2026-09-15T07:35`. Mengabaikan sakelar "aktif" supaya admin bisa memeriksa sebelum menyalakan. */
export async function GET(req: NextRequest) {
  try {
    await verifyRole(["ADMIN"]);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const waktu = new URL(req.url).searchParams.get("waktu") ?? "";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(waktu);
  if (!m) return Response.json({ error: "Format waktu: YYYY-MM-DDTJJ:MM (WIB)." }, { status: 400 });
  const saat = new Date(`${m[1]}T${m[2]}:${m[3]}:00+07:00`);
  if (Number.isNaN(saat.getTime())) return Response.json({ error: "Waktu tidak valid." }, { status: 400 });

  const hasil: { jenis: string; judul: string; isi: string; url: string | null; penerima: number }[] = [];
  try {
    await jalankanPengingat(saat, {
      kering: true,
      kirim: async n => {
        const penerima = new Set(n.userIds.filter(Boolean)).size;
        if (penerima) hasil.push({ jenis: n.jenis, judul: n.judul, isi: n.isi, url: n.url ?? null, penerima });
      },
    });
  } catch (e) {
    return Response.json({ error: `Pratinjau gagal: ${(e as Error).message}` }, { status: 500 });
  }
  return Response.json({ waktu, hasil, totalPenerima: hasil.reduce((t, h) => t + h.penerima, 0) });
}
