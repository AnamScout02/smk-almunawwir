import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBranding } from "@/lib/branding-guard";

function forbiddenOr(e: unknown, fallback: string) {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return Response.json({ error: "Khusus Koordinator Tim Branding & Publikasi." }, { status: 403 });
  }
  return Response.json({ error: fallback }, { status: 500 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const { id } = await params;
    const body = await req.json();
    const banner = await prisma.heroBanner.update({
      where: { id },
      data: { title: body.title, subtitle: body.subtitle, imageUrl: body.imageUrl || null, linkUrl: body.linkUrl || null, linkText: body.linkText || null, active: body.active ?? true },
    });
    return Response.json(banner);
  } catch (e) { return forbiddenOr(e, "Gagal mengupdate"); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertBranding(session);
    const { id } = await params;
    await prisma.heroBanner.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) { return forbiddenOr(e, "Gagal menghapus"); }
}
