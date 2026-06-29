import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const items = await prisma.admission.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(items);
  } catch { return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}
