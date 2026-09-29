import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { studentId } = await params;
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const internship = await prisma.internship.findUnique({
      where: { studentId },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            class: { select: { name: true } },
            major: { select: { name: true } },
          },
        },
        journal: { orderBy: { date: "desc" } },
      },
    });

    if (!internship || internship.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan siswa bimbingan Anda." }, { status: 403 });
    }

    const grade = await prisma.grade.findFirst({
      where: { studentId, teacherId: teacher.id, subject: "PKL", type: "Nilai PKL" },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ ...internship, pklGrade: grade?.score ?? null });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
