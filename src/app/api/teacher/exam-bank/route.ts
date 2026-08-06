import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { resolveTeacherId } from "@/lib/teacher-context";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");

    if (session.role === "ADMIN" || session.role === "TAS") {
      const items = await prisma.questionBankItem.findMany({
        where: { ...(subject ? { subject } : {}) },
        orderBy: { createdAt: "desc" },
      });
      return Response.json(items);
    }

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json([]);

    const items = await prisma.questionBankItem.findMany({
      where: { teacherId: teacher.id, ...(subject ? { subject } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(items);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);

    const { subject, question, optionA, optionB, optionC, optionD, correctAnswer } = await req.json();
    if (!subject?.trim() || !question?.trim() || !optionA?.trim() || !optionB?.trim() || !optionC?.trim() || !optionD?.trim() || !["A", "B", "C", "D"].includes(correctAnswer)) {
      return Response.json({ error: "Semua field soal wajib diisi dengan benar." }, { status: 400 });
    }

    const teacherId = await resolveTeacherId(session, { subject: subject.trim() });
    if (!teacherId) return Response.json({ error: "Tidak ditemukan guru pengampu mapel ini." }, { status: 400 });

    const item = await prisma.questionBankItem.create({
      data: { teacherId, subject: subject.trim(), question, optionA, optionB, optionC, optionD, correctAnswer },
    });
    return Response.json(item, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan soal." }, { status: 500 });
  }
}
