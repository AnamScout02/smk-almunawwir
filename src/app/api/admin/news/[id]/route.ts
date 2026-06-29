import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) return Response.json({ error: "Tidak ditemukan" }, { status: 404 });
    return Response.json(news);
  } catch { return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const news = await prisma.news.update({
      where: { id },
      data: { title: body.title, slug: body.slug, content: body.content, thumbnail: body.thumbnail || null, category: body.category, published: body.published },
    });
    return Response.json(news);
  } catch { return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    await prisma.news.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
