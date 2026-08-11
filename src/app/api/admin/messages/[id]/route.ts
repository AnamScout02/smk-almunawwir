import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const body = await req.json();
    const item = await prisma.contactMessage.update({ where: { id }, data: { isRead: body.isRead } });
    return Response.json(item);
  } catch { return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.contactMessage.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
