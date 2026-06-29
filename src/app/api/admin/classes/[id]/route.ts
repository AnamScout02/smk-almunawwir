import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const body = await req.json();
    const cls = await prisma.class.update({
      where: { id },
      data: {
        name: body.name,
        grade: Number(body.grade),
        majorId: body.majorId,
        homeroomId: body.homeroomId || null,
      },
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: { select: { id: true } },
      },
    });
    return Response.json(cls);
  } catch {
    return Response.json({ error: "Gagal mengupdate kelas" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    await prisma.class.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus kelas. Pastikan tidak ada siswa di kelas ini." }, { status: 500 });
  }
}
