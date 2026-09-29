import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json([]);

    const assignments = await prisma.assignment.findMany({
      where: { classId: student.classId },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(assignments.map(a => ({
      ...a,
      submissions: undefined,
      mySubmission: a.submissions[0] ?? null,
    })));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
