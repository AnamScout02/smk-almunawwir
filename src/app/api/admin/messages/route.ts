import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    await verifyTasAccess();
    const items = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(items);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}

export async function PATCH() {
  try {
    await verifyTasAccess();
    await prisma.contactMessage.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal" }, { status: 500 }); }
}
