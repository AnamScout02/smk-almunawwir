import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const banners = await prisma.heroBanner.findMany({ orderBy: { order: "asc" } });
    return Response.json(banners);
  } catch { return Response.json({ error: "Gagal memuat data" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const count = await prisma.heroBanner.count();
    const banner = await prisma.heroBanner.create({
      data: { title: body.title, subtitle: body.subtitle, imageUrl: body.imageUrl || null, linkUrl: body.linkUrl || null, linkText: body.linkText || null, active: body.active ?? true, order: count },
    });
    return Response.json(banner);
  } catch { return Response.json({ error: "Gagal menyimpan" }, { status: 500 }); }
}
