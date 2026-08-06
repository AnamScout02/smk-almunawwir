import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const quiz = await prisma.quiz.findFirst({
      where: { id, classId: student.classId, isPublished: true },
      include: { questions: true },
    });
    if (!quiz) return Response.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    const existing = await prisma.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: id, studentId: student.id } } });
    if (existing?.submittedAt) return Response.json({ error: "Kuis ini sudah pernah Anda kerjakan." }, { status: 400 });

    if (quiz.duration && existing) {
      const deadline = existing.startedAt.getTime() + quiz.duration * 60000;
      const GRACE_MS = 5 * 60 * 1000;
      if (Date.now() > deadline + GRACE_MS) {
        return Response.json({ error: "Waktu kuis sudah habis. Hubungi guru pengampu untuk penyesuaian." }, { status: 403 });
      }
    }

    const { answers } = await req.json() as { answers: Record<string, string> };
    if (!answers || typeof answers !== "object") {
      return Response.json({ error: "Jawaban tidak lengkap" }, { status: 400 });
    }

    let correct = 0;
    for (const q of quiz.questions) {
      if (answers[q.id] === q.correctAnswer) correct++;
    }
    const score = Math.round((correct / quiz.questions.length) * 100);

    const attempt = await prisma.quizAttempt.upsert({
      where: { quizId_studentId: { quizId: id, studentId: student.id } },
      update: { answers, score, submittedAt: new Date() },
      create: { quizId: id, studentId: student.id, answers, score, submittedAt: new Date() },
    });

    return Response.json(attempt, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal mengumpulkan kuis." }, { status: 500 });
  }
}
