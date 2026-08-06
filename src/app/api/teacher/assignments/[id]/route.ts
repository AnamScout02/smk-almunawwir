import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id } = await params;
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { class: { select: { name: true, students: { where: { studentStatus: "AKTIF" }, include: { user: { select: { name: true } } } } } } },
    });
    if (!assignment || assignment.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan tugas Anda." }, { status: 403 });
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id },
      include: { student: { include: { user: { select: { name: true } } } } },
    });

    return Response.json({ ...assignment, submissions });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id } = await params;
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { teacherId: true } });
    if (!assignment || assignment.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan tugas Anda." }, { status: 403 });
    }

    await prisma.assignment.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus tugas." }, { status: 500 });
  }
}
