import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBranding } from "@/lib/branding-guard";

function forbiddenOr(e: unknown, fallback: string) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return Response.json({ error: "Khusus Koordinator Tim Branding & Publikasi." }, { status: 403 });
  }
  return Response.json({ error: fallback }, { status: 500 });
}

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
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const { id } = await params;
    const body = await req.json();
    const news = await prisma.news.update({
      where: { id },
      data: { title: body.title, slug: body.slug, content: body.content, thumbnail: body.thumbnail || null, category: body.category, published: body.published },
    });
    return Response.json(news);
  } catch (e) { return forbiddenOr(e, "Gagal mengupdate"); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const { id } = await params;
    await prisma.news.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) { return forbiddenOr(e, "Gagal menghapus"); }
}
