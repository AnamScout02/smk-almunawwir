import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const { studentId } = await params;
    const internship = await prisma.internship.findUnique({
      where: { studentId },
      include: { journal: { orderBy: { date: "desc" } } },
    });
    if (!internship) return Response.json({ error: "Data PKL tidak ditemukan" }, { status: 404 });
    return Response.json(internship);
  } catch {
    return Response.json({ error: "Gagal memuat jurnal PKL" }, { status: 500 });
  }
}
