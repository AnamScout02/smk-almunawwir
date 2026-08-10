import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;

    const body = await req.json();
    const { handlingType, note, status } = body as { handlingType?: string; note?: string; status?: string };
    const existing = await prisma.studentCaseNote.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Catatan tidak ditemukan" }, { status: 404 });

    const updated = await prisma.studentCaseNote.update({
      where: { id },
      data: {
        ...(handlingType?.trim() ? { handlingType: handlingType.trim() } : {}),
        ...(note?.trim() ? { note: note.trim() } : {}),
        ...(status === "BERJALAN" || status === "SELESAI" ? { status } : {}),
      },
    });
    return Response.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    await prisma.studentCaseNote.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
