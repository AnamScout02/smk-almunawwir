import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        homeroomOf: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(teachers);
  } catch {
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
