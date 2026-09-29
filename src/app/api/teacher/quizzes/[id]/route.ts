import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

async function getTeacher(email: string) {
  return prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const quiz = await prisma.quiz.findFirst({
      where: { id, teacherId: teacher.id },
      include: {
        class: { select: { name: true, students: { where: { studentStatus: "AKTIF" }, select: { id: true } } } },
        questions: { orderBy: { order: "asc" } },
        attempts: { where: { submittedAt: { not: null } }, include: { student: { include: { user: { select: { name: true } } } } }, orderBy: { score: "desc" } },
      },
    });
    if (!quiz) return Response.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    return Response.json(quiz);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface QuestionInput { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.quiz.findFirst({ where: { id, teacherId: teacher.id } });
    if (!existing) return Response.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    const body = await req.json();

    if (typeof body.isPublished === "boolean" && Object.keys(body).length === 1) {
      const quiz = await prisma.quiz.update({ where: { id }, data: { isPublished: body.isPublished } });
      return Response.json(quiz);
    }

    const { title, description, duration, questions } = body;
    const qs = (questions ?? []) as QuestionInput[];
    if (!title?.trim() || qs.length === 0) {
      return Response.json({ error: "Judul dan minimal 1 soal wajib diisi." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.quizQuestion.deleteMany({ where: { quizId: id } });
      await tx.quiz.update({
        where: { id },
        data: {
          title: title.trim(), description: description?.trim() || null, duration: duration ? Number(duration) : null,
          questions: { create: qs.map((q, i) => ({ ...q, order: i })) },
        },
      });
    });

    const quiz = await prisma.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
    return Response.json(quiz);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengupdate kuis." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.quiz.findFirst({ where: { id, teacherId: teacher.id } });
    if (!existing) return Response.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    await prisma.quiz.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus kuis." }, { status: 500 });
  }
}
