import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const items = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(items);
  } catch { return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}

export async function PATCH() {
  try {
    await verifyRole(["ADMIN"]);
    await prisma.contactMessage.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Gagal" }, { status: 500 }); }
}
