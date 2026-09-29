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
    const items = await prisma.gallery.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
    return Response.json(items);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const body = await req.json();
    const count = await prisma.gallery.count();
    const item = await prisma.gallery.create({
      data: { title: body.title, imageUrl: body.imageUrl, category: body.category || "Umum", caption: body.caption || null, order: count },
    });
    return Response.json(item);
  } catch (e) { lemparBilaPengalihan(e); return forbiddenOr(e, "Gagal menyimpan"); }
}
