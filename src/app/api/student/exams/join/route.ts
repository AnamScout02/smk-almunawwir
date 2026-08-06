import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await req.json();
    if (!token?.trim()) return Response.json({ error: "Masukkan token ujian." }, { status: 400 });

    const exam = await prisma.exam.findUnique({ where: { token: token.trim().toUpperCase() } });
    if (!exam || exam.classId !== student.classId || !exam.isPublished) {
      return Response.json({ error: "Token tidak ditemukan atau ujian ini bukan untuk kelas Anda." }, { status: 404 });
    }

    const now = new Date();
    if (now < exam.startTime) return Response.json({ error: "Ujian belum dibuka." }, { status: 400 });
    if (now > exam.endTime) return Response.json({ error: "Waktu ujian sudah berakhir." }, { status: 400 });

    let attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: student.id } } });
    if (!attempt) {
      attempt = await prisma.examAttempt.create({ data: { examId: exam.id, studentId: student.id } });
    }
    if (attempt.submittedAt) {
      return Response.json({ error: "Anda sudah mengumpulkan ujian ini." }, { status: 400 });
    }

    return Response.json({ examId: exam.id });
  } catch {
    return Response.json({ error: "Gagal bergabung ke ujian." }, { status: 500 });
  }
}
