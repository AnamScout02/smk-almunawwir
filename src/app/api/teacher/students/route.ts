import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    let allowedClassIds: string[] | null = null;
    if (session.role === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        include: {
          homeroomOf: { select: { id: true } },
          teachingLoad: { select: { classId: true } },
        },
      });
      const homeroomIds = teacher?.homeroomOf.map(c => c.id) ?? [];
      const assignedIds = teacher?.teachingLoad.map(a => a.classId) ?? [];
      allowedClassIds = [...new Set([...homeroomIds, ...assignedIds])];
      if (classId && !allowedClassIds.includes(classId)) {
        return Response.json({ error: "Anda tidak memiliki akses ke kelas ini" }, { status: 403 });
      }
      if (!classId && allowedClassIds.length === 0) return Response.json([]);
    }

    const where: Record<string, unknown> = { studentStatus: "AKTIF" };
    if (classId) where.classId = classId;
    else if (allowedClassIds) where.classId = { in: allowedClassIds };

    const students = await prisma.student.findMany({
      where,
      include: { user: { select: { name: true } }, class: true, major: true },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
