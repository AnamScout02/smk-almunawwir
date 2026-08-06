import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);

    if (session.role === "ADMIN" || session.role === "TAS") {
      const assignments = await prisma.teachingAssignment.findMany({
        select: {
          classId: true,
          class: { select: { name: true, grade: true } },
          subjectId: true,
          subject: { select: { name: true } },
          teacherId: true,
          teacher: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ class: { grade: "asc" } }, { class: { name: "asc" } }],
      });
      const seen = new Set<string>();
      const result = [];
      for (const a of assignments) {
        const key = `${a.classId}::${a.subject.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          classId: a.classId, className: a.class.name, grade: a.class.grade,
          subjectId: a.subjectId, subjectName: a.subject.name,
          teacherId: a.teacherId, teacherName: a.teacher.user.name,
        });
      }
      return Response.json(result);
    }

    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: { id: true },
    });
    if (!teacher) return Response.json([]);

    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      select: {
        classId: true,
        class: { select: { name: true, grade: true } },
        subjectId: true,
        subject: { select: { name: true } },
      },
      orderBy: [{ class: { grade: "asc" } }, { class: { name: "asc" } }],
    });

    return Response.json(assignments.map(a => ({
      classId: a.classId,
      className: a.class.name,
      grade: a.class.grade,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
    })));
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
