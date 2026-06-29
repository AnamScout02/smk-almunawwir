import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const items = await prisma.gallery.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
    return Response.json(items);
  } catch { return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const count = await prisma.gallery.count();
    const item = await prisma.gallery.create({
      data: { title: body.title, imageUrl: body.imageUrl, category: body.category || "Umum", caption: body.caption || null, order: count },
    });
    return Response.json(item);
  } catch { return Response.json({ error: "Gagal menyimpan" }, { status: 500 }); }
}
