import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    if (!teacherId) return Response.json([]);

    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId },
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
    return Response.json({ error: "Gagal memuat kelas" }, { status: 500 });
  }
}
