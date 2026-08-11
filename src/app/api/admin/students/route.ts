import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyTasAccess();
    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: true,
        major: true,
      },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
