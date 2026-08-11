import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyTasAccess();
    const [majors, teachers] = await Promise.all([
      prisma.major.findMany({ orderBy: { name: "asc" } }),
      prisma.teacher.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);
    return Response.json({ majors, teachers });
  } catch {
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
