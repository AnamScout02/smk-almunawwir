import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { susunKelengkapan } from "@/lib/kelengkapan-perangkat";

export const dynamic = "force-dynamic";

/** Kelengkapan perangkat ajar semester berjalan. Admin/staf TU & Wakil Kepala Kurikulum melihat SEMUA guru;
 * guru lain hanya baris miliknya sendiri — supaya ia tahu apa yang masih kurang tanpa membuka data rekan. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  let semua = true;
  try { await assertKurikulum(session); } catch { semua = false; }
  let teacherId: string | undefined;
  if (!semua) {
    const t = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
    if (!t) return Response.json({ error: "Akun ini tidak terhubung ke data guru." }, { status: 403 });
    teacherId = t.id;
  }
  const h = await susunKelengkapan({ teacherId });
  return Response.json({ ...h, cakupan: semua ? "SEMUA" : "SENDIRI" });
}
