import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id } = await params;
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const material = await prisma.material.findUnique({ where: { id }, select: { teacherId: true } });
    if (!material || material.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan materi Anda." }, { status: 403 });
    }

    await prisma.material.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus materi." }, { status: 500 });
  }
}
