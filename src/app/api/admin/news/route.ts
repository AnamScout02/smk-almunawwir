import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const news = await prisma.news.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(news);
  } catch { return Response.json({ error: "Gagal memuat data" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
    const news = await prisma.news.create({
      data: { title: body.title, slug: body.slug || slug, content: body.content, thumbnail: body.thumbnail || null, category: body.category || "Umum", published: body.published ?? false },
    });
    return Response.json(news);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan";
    return Response.json({ error: msg }, { status: 500 });
  }
}
