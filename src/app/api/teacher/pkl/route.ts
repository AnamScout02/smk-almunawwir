import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json([]);

    const internships = await prisma.internship.findMany({
      where: { teacherId: teacher.id, student: { studentStatus: "AKTIF" } },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            class: { select: { name: true } },
            major: { select: { name: true } },
          },
        },
        journal: { orderBy: { date: "desc" } },
      },
      orderBy: { student: { user: { name: "asc" } } },
    });

    return Response.json(internships);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
