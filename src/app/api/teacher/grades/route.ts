import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
    if (!teacher) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    const grades = await prisma.grade.findMany({
      where: { teacherId: teacher.id, ...(classId ? { student: { classId } } : {}) },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(grades);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { grades } = await req.json();

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
    if (!teacher) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    type GradeInput = { studentId: string; subject: string; type: string; semester: string; score: number };

    await prisma.$transaction(async (tx) => {
      for (const g of grades as GradeInput[]) {
        await tx.grade.deleteMany({
          where: {
            studentId: g.studentId,
            teacherId: teacher.id,
            subject: g.subject,
            type: g.type,
            semester: g.semester,
          },
        });
        await tx.grade.create({
          data: {
            studentId: g.studentId,
            teacherId: teacher.id,
            subject: g.subject,
            type: g.type,
            semester: g.semester,
            score: g.score,
          },
        });
      }
    });

    return Response.json({ count: grades.length }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan nilai" }, { status: 500 });
  }
}
