import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const { id } = await params;
    const { fileUrl, note } = await req.json();

    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
    if (!student) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { classId: true } });
    if (!assignment || assignment.classId !== student.classId) {
      return Response.json({ error: "Tugas ini bukan untuk kelas Anda." }, { status: 403 });
    }

    if (!fileUrl && !note?.trim()) {
      return Response.json({ error: "Lampirkan file atau tulis catatan." }, { status: 400 });
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
      create: { assignmentId: id, studentId: student.id, fileUrl: fileUrl || null, note: note?.trim() || null },
      update: { fileUrl: fileUrl || null, note: note?.trim() || null, submittedAt: new Date() },
    });

    return Response.json(submission);
  } catch {
    return Response.json({ error: "Gagal mengumpulkan tugas." }, { status: 500 });
  }
}
