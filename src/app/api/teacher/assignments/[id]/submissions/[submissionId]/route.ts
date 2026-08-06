import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; submissionId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id, submissionId } = await params;
    const { score, feedback } = await req.json();

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { teacherId: true } });
    if (!assignment || assignment.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan tugas Anda." }, { status: 403 });
    }

    const submission = await prisma.assignmentSubmission.update({
      where: { id: submissionId, assignmentId: id },
      data: {
        score: score === null || score === "" ? null : Number(score),
        feedback: feedback || null,
      },
    });

    return Response.json(submission);
  } catch {
    return Response.json({ error: "Gagal menyimpan nilai." }, { status: 500 });
  }
}
