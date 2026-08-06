import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const exam = await prisma.exam.findFirst({
      where: { id, classId: student.classId, isPublished: true },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        questions: { orderBy: { order: "asc" } },
        attempts: { where: { studentId: student.id } },
      },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const myAttempt = exam.attempts[0];
    if (!myAttempt) return Response.json({ error: "Anda belum bergabung ke ujian ini. Masukkan token terlebih dahulu." }, { status: 403 });

    const submitted = !!myAttempt.submittedAt;
    const deadline = new Date(Math.min(new Date(myAttempt.startedAt).getTime() + exam.duration * 60000, exam.endTime.getTime()));

    return Response.json({
      id: exam.id, title: exam.title, description: exam.description, subject: exam.subject, duration: exam.duration,
      teacher: exam.teacher, startedAt: myAttempt.startedAt, deadline, submitted,
      score: myAttempt.score, answers: submitted ? myAttempt.answers : undefined,
      questions: exam.questions.map(q => ({
        id: q.id, question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        correctAnswer: submitted ? q.correctAnswer : undefined,
      })),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
