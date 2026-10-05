import { prisma } from "@/lib/prisma";
import { ujiSeb } from "@/lib/seb";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Uji Safe Exam Browser dari komputer lab (halaman /seb-uji, tanpa login — SEB dibuka sebelum siapa pun
 *  masuk). Bila Config Key berkas buatan situs cocok, kunci itu dicatat TERVERIFIKASI dan sejak itu
 *  ujian ber-"Wajib SEB" benar-benar dikunci (src/lib/seb.ts). Config Key-nya sendiri tidak dikirim balik. */
export async function GET(req: Request) {
  if (!checkRateLimit(`seb-uji:${getClientIp(req)}`, 30, 10 * 60_000)) return Response.json({ error: "Terlalu sering." }, { status: 429 });
  const h = await ujiSeb(req);
  let baruTerverifikasi = false;
  if (h.cocokOtomatis && !h.sudahTerverifikasi) {
    await prisma.siteSetting.upsert({
      where: { key: "ujian.sebCkTerverifikasi" },
      update: { value: h.configKey }, create: { key: "ujian.sebCkTerverifikasi", value: h.configKey },
    }).catch(() => {});
    baruTerverifikasi = true;
  }
  return Response.json({
    adaSeb: h.adaSeb, adaHeader: h.adaHeader, cocokOtomatis: h.cocokOtomatis, cocokBek: h.cocokBek, cocokCkManual: h.cocokCkManual,
    terverifikasi: h.sudahTerverifikasi || baruTerverifikasi, baruTerverifikasi,
  }, { headers: { "Cache-Control": "no-store" } });
}
