import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { resolveTeacherId } from "@/lib/teacher-context";
import { NextRequest } from "next/server";

const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa karakter ambigu (0/O, 1/I)
function randomToken(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  return out;
}

async function generateUniqueToken() {
  for (let i = 0; i < 10; i++) {
    const token = randomToken();
    const exists = await prisma.exam.findUnique({ where: { token } });
    if (!exists) return token;
  }
  throw new Error("Gagal membuat token unik");
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const subject = searchParams.get("subject");

    const include = {
      class: { select: { name: true } },
      _count: { select: { questions: true, attempts: true } },
      attempts: { where: { submittedAt: { not: null } }, select: { score: true } },
    };

    if (session.role === "ADMIN" || session.role === "TAS") {
      const exams = await prisma.exam.findMany({
        where: { ...(classId ? { classId } : {}), ...(subject ? { subject } : {}) },
        include,
        orderBy: { createdAt: "desc" },
      });
      return Response.json(exams);
    }

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json([]);

    const exams = await prisma.exam.findMany({
      where: {
        teacherId: teacher.id,
        ...(classId ? { classId } : {}),
        ...(subject ? { subject } : {}),
      },
      include,
      orderBy: { createdAt: "desc" },
    });
    return Response.json(exams);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface QuestionInput { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);

    const { classId, subject, title, description, duration, startTime, endTime, questions } = await req.json();
    if (!classId || !subject?.trim() || !title?.trim() || !duration || !startTime || !endTime) {
      return Response.json({ error: "Kelas, mata pelajaran, judul, durasi, dan jadwal wajib diisi." }, { status: 400 });
    }
    const qs = (questions ?? []) as QuestionInput[];
    if (qs.length === 0 || qs.some(q => !q.question?.trim() || !q.optionA?.trim() || !q.optionB?.trim() || !q.optionC?.trim() || !q.optionD?.trim() || !["A", "B", "C", "D"].includes(q.correctAnswer))) {
      return Response.json({ error: "Minimal 1 soal, semua pilihan jawaban dan kunci jawaban wajib diisi." }, { status: 400 });
    }
    if (new Date(startTime) >= new Date(endTime)) {
      return Response.json({ error: "Waktu mulai harus sebelum waktu selesai." }, { status: 400 });
    }

    const teacherId = await resolveTeacherId(session, { classId, subject });
    if (!teacherId) {
      return Response.json({ error: "Anda tidak mengajar mapel ini di kelas tersebut." }, { status: 403 });
    }

    const token = await generateUniqueToken();
    const exam = await prisma.exam.create({
      data: {
        teacherId, classId, subject: subject.trim(), title: title.trim(),
        description: description?.trim() || null, duration: Number(duration),
        startTime: new Date(startTime), endTime: new Date(endTime), token,
        questions: { create: qs.map((q, i) => ({ ...q, order: i })) },
      },
    });

    return Response.json(exam);
  } catch {
    return Response.json({ error: "Gagal menyimpan ujian." }, { status: 500 });
  }
}
