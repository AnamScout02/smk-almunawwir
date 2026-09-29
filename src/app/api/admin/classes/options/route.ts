import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
