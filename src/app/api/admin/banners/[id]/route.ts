import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const banner = await prisma.heroBanner.update({
      where: { id },
      data: { title: body.title, subtitle: body.subtitle, imageUrl: body.imageUrl || null, linkUrl: body.linkUrl || null, linkText: body.linkText || null, active: body.active ?? true },
    });
    return Response.json(banner);
  } catch { return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    await prisma.heroBanner.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
