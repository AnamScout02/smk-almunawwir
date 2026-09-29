import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBranding } from "@/lib/branding-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function forbiddenOr(e: unknown, fallback: string) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return Response.json({ error: "Khusus Koordinator Tim Branding & Publikasi." }, { status: 403 });
  }
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const banners = await prisma.heroBanner.findMany({ orderBy: { order: "asc" } });
    return Response.json(banners);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat data" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const body = await req.json();
    const count = await prisma.heroBanner.count();
    const banner = await prisma.heroBanner.create({
      data: { title: body.title, subtitle: body.subtitle, imageUrl: body.imageUrl || null, linkUrl: body.linkUrl || null, linkText: body.linkText || null, active: body.active ?? true, order: count },
    });
    return Response.json(banner);
  } catch (e) { lemparBilaPengalihan(e); return forbiddenOr(e, "Gagal menyimpan"); }
}
