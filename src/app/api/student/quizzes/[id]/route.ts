import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const quiz = await prisma.quiz.findFirst({
      where: { id, classId: student.classId, isPublished: true },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        questions: { orderBy: { order: "asc" } },
        attempts: { where: { studentId: student.id } },
      },
    });
    if (!quiz) return Response.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    let myAttempt = quiz.attempts[0] ?? null;
    if (!myAttempt) {
      myAttempt = await prisma.quizAttempt.create({
        data: { quizId: id, studentId: student.id },
      });
    }
    const alreadyAttempted = !!myAttempt.submittedAt;
    const deadline = quiz.duration ? new Date(myAttempt.startedAt.getTime() + quiz.duration * 60000) : null;

    return Response.json({
      id: quiz.id, title: quiz.title, description: quiz.description, subject: quiz.subject, duration: quiz.duration,
      teacher: quiz.teacher,
      alreadyAttempted,
      deadline,
      myAttempt,
      questions: quiz.questions.map(q => ({
        id: q.id, question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        // kunci jawaban hanya dikirim setelah siswa mengerjakan, untuk mencegah kecurangan
        correctAnswer: alreadyAttempted ? q.correctAnswer : undefined,
      })),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
