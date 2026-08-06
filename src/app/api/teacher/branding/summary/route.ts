import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Koordinator Tim Branding & Publikasi"]);

    const [totalNews, publishedNews, draftNews, latestNews, totalGallery, galleryByCategory, lastPublished] = await Promise.all([
      prisma.news.count(),
      prisma.news.count({ where: { published: true } }),
      prisma.news.count({ where: { published: false } }),
      prisma.news.findMany({
        orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, title: true, category: true, createdAt: true, published: true },
      }),
      prisma.gallery.count(),
      prisma.gallery.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.news.findFirst({ where: { published: true }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);

    const daysSinceLastPublish = lastPublished
      ? Math.floor((Date.now() - new Date(lastPublished.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return Response.json({
      totalNews, publishedNews, draftNews, latestNews,
      totalGallery,
      galleryByCategory: galleryByCategory.map(g => ({ category: g.category, count: g._count._all })).sort((a, b) => b.count - a.count),
      daysSinceLastPublish,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Koordinator Tim Branding & Publikasi." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
