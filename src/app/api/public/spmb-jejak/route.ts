import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SEMUA_TAHAP } from "@/lib/spmb-jejak";

export const dynamic = "force-dynamic";

/** Penerima jejak corong SPMB (publik, tanpa login). Hanya (sesi acak, tahap) yang disimpan — tidak
 *  ada IP, nama, atau isian formulir. Dibatasi per IP supaya tidak bisa dipakai menggelembungkan
 *  angka; duplikat per (sesi, tahap) dilewati oleh kunci unik tabel. Selalu menjawab 204 — pencatat
 *  di browser tidak membaca balasannya. */
export async function POST(req: Request) {
  try {
    if (!checkRateLimit(`spmb-jejak:${getClientIp(req)}`, 60, 10 * 60_000)) return new Response(null, { status: 204 });
    const d = await req.json().catch(() => null) as { sesi?: unknown; tahap?: unknown } | null;
    const sesi = typeof d?.sesi === "string" ? d.sesi : "";
    const tahap = typeof d?.tahap === "string" ? d.tahap : "";
    if (!/^[a-z0-9]{20}$/.test(sesi) || !SEMUA_TAHAP.has(tahap)) return new Response(null, { status: 204 });
    await prisma.spmbJejak.createMany({ data: [{ sesi, tahap }], skipDuplicates: true });
  } catch { /* statistik tidak boleh menghasilkan galat bagi pengunjung */ }
  return new Response(null, { status: 204 });
}
