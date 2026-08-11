import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyTasAccess();
    const items = await prisma.admission.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json(items);
  } catch { return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}
