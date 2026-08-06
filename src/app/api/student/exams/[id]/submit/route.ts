import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const exam = await prisma.exam.findFirst({
      where: { id, classId: student.classId, isPublished: true },
      include: { questions: true },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } });
    if (!attempt) return Response.json({ error: "Anda belum bergabung ke ujian ini." }, { status: 400 });
    if (attempt.submittedAt) return Response.json({ error: "Ujian ini sudah pernah Anda kumpulkan." }, { status: 400 });

    const deadline = Math.min(attempt.startedAt.getTime() + exam.duration * 60000, exam.endTime.getTime());
    const GRACE_MS = 5 * 60 * 1000; // toleransi keterlambatan jaringan
    if (Date.now() > deadline + GRACE_MS) {
      return Response.json({ error: "Waktu ujian sudah habis. Hubungi guru pengampu untuk penyesuaian." }, { status: 403 });
    }

    const { answers } = await req.json() as { answers: Record<string, string> };
    if (!answers || typeof answers !== "object") {
      return Response.json({ error: "Jawaban tidak lengkap" }, { status: 400 });
    }

    let correct = 0;
    for (const q of exam.questions) {
      if (answers[q.id] === q.correctAnswer) correct++;
    }
    const score = Math.round((correct / exam.questions.length) * 100);

    const updated = await prisma.examAttempt.update({
      where: { examId_studentId: { examId: id, studentId: student.id } },
      data: { answers, score, submittedAt: new Date() },
    });

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengumpulkan ujian." }, { status: 500 });
  }
}
