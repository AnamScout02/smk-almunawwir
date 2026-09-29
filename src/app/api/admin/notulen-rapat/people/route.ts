import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    await verifyTasAccess();
    const people = await prisma.user.findMany({
      where: { role: { in: ["TEACHER", "ADMIN", "TAS"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return Response.json(people);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
