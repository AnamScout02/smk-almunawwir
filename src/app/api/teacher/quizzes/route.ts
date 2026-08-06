import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

async function getTeacher(email: string) {
  return prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json([]);

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const subject = searchParams.get("subject");

    const quizzes = await prisma.quiz.findMany({
      where: {
        teacherId: teacher.id,
        ...(classId ? { classId } : {}),
        ...(subject ? { subject } : {}),
      },
      include: { class: { select: { name: true } }, _count: { select: { questions: true, attempts: { where: { submittedAt: { not: null } } } } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(quizzes);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface QuestionInput { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { classId, subject, title, description, duration, questions } = await req.json();
    if (!classId || !subject?.trim() || !title?.trim()) {
      return Response.json({ error: "Kelas, mata pelajaran, dan judul wajib diisi." }, { status: 400 });
    }
    const qs = (questions ?? []) as QuestionInput[];
    if (qs.length === 0 || qs.some(q => !q.question?.trim() || !q.optionA?.trim() || !q.optionB?.trim() || !q.optionC?.trim() || !q.optionD?.trim() || !["A", "B", "C", "D"].includes(q.correctAnswer))) {
      return Response.json({ error: "Minimal 1 soal, semua pilihan jawaban dan kunci jawaban wajib diisi." }, { status: 400 });
    }

    const hasAccess = await prisma.teachingAssignment.findFirst({
      where: { teacherId: teacher.id, classId, subject: { name: subject } },
    });
    if (!hasAccess) {
      return Response.json({ error: "Anda tidak mengajar mapel ini di kelas tersebut." }, { status: 403 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        teacherId: teacher.id, classId, subject: subject.trim(), title: title.trim(),
        description: description?.trim() || null, duration: duration ? Number(duration) : null,
        questions: { create: qs.map((q, i) => ({ ...q, order: i })) },
      },
    });

    return Response.json(quiz);
  } catch {
    return Response.json({ error: "Gagal menyimpan kuis." }, { status: 500 });
  }
}
