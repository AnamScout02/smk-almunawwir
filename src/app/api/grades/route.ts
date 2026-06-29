import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const gradeSchema = z.object({
  studentId: z.string(),
  subject: z.string().min(1),
  score: z.number().min(0).max(100),
  type: z.enum(["UH", "UTS", "UAS", "Praktik"]),
  semester: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["TEACHER", "ADMIN"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 });
  }

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const grade = await prisma.grade.create({
    data: { ...parsed.data, teacherId: teacher.id },
  });

  return Response.json({ success: true, grade }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  const grades = await prisma.grade.findMany({
    where: studentId ? { studentId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ grades });
}
