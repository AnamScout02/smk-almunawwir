import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: {
        homeroomOf: {
          include: {
            major: true,
            students: { select: { id: true } },
          },
          orderBy: { grade: "asc" },
        },
      },
    });
    return Response.json(teacher?.homeroomOf ?? []);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
