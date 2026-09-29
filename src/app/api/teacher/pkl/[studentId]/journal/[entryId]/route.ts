import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string; entryId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { studentId, entryId } = await params;
    const { teacherNote } = await req.json();

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const internship = await prisma.internship.findUnique({ where: { studentId }, select: { id: true, teacherId: true } });
    if (!internship || internship.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan siswa bimbingan Anda." }, { status: 403 });
    }

    const entry = await prisma.internshipJournal.update({
      where: { id: entryId, internshipId: internship.id },
      data: { teacherNote: teacherNote || "" },
    });

    return Response.json(entry);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan catatan." }, { status: 500 });
  }
}
