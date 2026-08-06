import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json([]);

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");

    const quizzes = await prisma.quiz.findMany({
      where: { classId: student.classId, isPublished: true, ...(subject ? { subject } : {}) },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: student.id }, select: { score: true, submittedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = quizzes.map(q => ({
      id: q.id, title: q.title, description: q.description, subject: q.subject, duration: q.duration, createdAt: q.createdAt,
      teacher: q.teacher, questionCount: q._count.questions,
      myAttempt: q.attempts[0] ?? null,
    }));

    return Response.json(result);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
