import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { cakupanTingkat } from "@/lib/kehadiran-guru";
import { susunKeterlaksanaan } from "@/lib/keterlaksanaan";

export const dynamic = "force-dynamic";

/** Papan keterlaksanaan kurikulum. Pimpinan melihat semua guru; guru lain hanya baris miliknya.
 *  Bawaan = tingkat yang dipantau piket (`kedisiplinan.tingkat`, mis. X & XI saat XII PKL); `?semua=1` = semua tingkat. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const semua = await bolehPantauGuru(session);
  let teacherId: string | undefined;
  if (!semua) {
    const t = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
    if (!t) return Response.json({ error: "Akun ini tidak terhubung ke data guru." }, { status: 403 });
    teacherId = t.id;
  }
  const semuaTingkat = new URL(req.url).searchParams.get("semua") === "1" || !semua;
  const dipantau = await cakupanTingkat();
  const h = await susunKeterlaksanaan({ teacherId, tingkat: semuaTingkat ? undefined : dipantau });
  return Response.json({ ...h, cakupan: semua ? "SEMUA" : "SENDIRI", dipantau, semuaTingkat });
}
