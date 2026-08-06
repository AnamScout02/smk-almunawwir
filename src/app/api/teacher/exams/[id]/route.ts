import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

async function findScopedExam(session: { role: string; email: string }, id: string) {
  if (session.role === "ADMIN" || session.role === "TAS") {
    return prisma.exam.findUnique({ where: { id } });
  }
  const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
  if (!teacher) return null;
  return prisma.exam.findFirst({ where: { id, teacherId: teacher.id } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const scoped = await findScopedExam(session, id);
    if (!scoped) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        class: { select: { name: true, students: { where: { studentStatus: "AKTIF" }, select: { id: true, nis: true, user: { select: { name: true } } } } } },
        questions: { orderBy: { order: "asc" } },
        attempts: { select: { studentId: true, score: true, startedAt: true, submittedAt: true } },
      },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const attemptByStudent = Object.fromEntries(exam.attempts.map(a => [a.studentId, a]));
    const monitoring = exam.class.students.map(st => {
      const a = attemptByStudent[st.id];
      let status: "BELUM_MULAI" | "SEDANG_MENGERJAKAN" | "SELESAI" = "BELUM_MULAI";
      if (a?.submittedAt) status = "SELESAI";
      else if (a) status = "SEDANG_MENGERJAKAN";
      return { student: st, status, score: a?.score ?? null, startedAt: a?.startedAt ?? null, submittedAt: a?.submittedAt ?? null };
    });

    return Response.json({
      id: exam.id, title: exam.title, description: exam.description, subject: exam.subject, token: exam.token,
      duration: exam.duration, startTime: exam.startTime, endTime: exam.endTime, isPublished: exam.isPublished,
      class: { name: exam.class.name, students: exam.class.students },
      questions: exam.questions, monitoring,
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface QuestionInput { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const existing = await findScopedExam(session, id);
    if (!existing) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const body = await req.json();

    if (typeof body.isPublished === "boolean" && Object.keys(body).length === 1) {
      const exam = await prisma.exam.update({ where: { id }, data: { isPublished: body.isPublished } });
      return Response.json(exam);
    }

    const { title, description, duration, startTime, endTime, questions } = body;
    const qs = (questions ?? []) as QuestionInput[];
    if (!title?.trim() || qs.length === 0 || !duration || !startTime || !endTime) {
      return Response.json({ error: "Judul, jadwal, durasi, dan minimal 1 soal wajib diisi." }, { status: 400 });
    }
    if (new Date(startTime) >= new Date(endTime)) {
      return Response.json({ error: "Waktu mulai harus sebelum waktu selesai." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.examQuestion.deleteMany({ where: { examId: id } });
      await tx.exam.update({
        where: { id },
        data: {
          title: title.trim(), description: description?.trim() || null, duration: Number(duration),
          startTime: new Date(startTime), endTime: new Date(endTime),
          questions: { create: qs.map((q, i) => ({ ...q, order: i })) },
        },
      });
    });

    const exam = await prisma.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
    return Response.json(exam);
  } catch {
    return Response.json({ error: "Gagal mengupdate ujian." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const existing = await findScopedExam(session, id);
    if (!existing) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    await prisma.exam.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus ujian." }, { status: 500 });
  }
}
