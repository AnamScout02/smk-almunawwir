import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const { nis, nisn, majorId, classId } = await req.json();

    const student = await prisma.student.update({
      where: { id },
      data: { nis, nisn: nisn || null, majorId, classId: classId || null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: true,
        major: true,
      },
    });
    return Response.json(student);
  } catch {
    return Response.json({ error: "Gagal mengupdate siswa" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    await prisma.student.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
