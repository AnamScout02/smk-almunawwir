import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;

    if (session.role === "ADMIN" || session.role === "TAS") {
      await prisma.questionBankItem.delete({ where: { id } }).catch(() => null);
      return Response.json({ ok: true });
    }

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.questionBankItem.findFirst({ where: { id, teacherId: teacher.id } });
    if (!existing) return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });

    await prisma.questionBankItem.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus soal." }, { status: 500 });
  }
}
