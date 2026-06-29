import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const body = await req.json();
    const item = await prisma.admission.update({ where: { id }, data: { status: body.status, notes: body.notes || null } });
    return Response.json(item);
  } catch { return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    await prisma.admission.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
