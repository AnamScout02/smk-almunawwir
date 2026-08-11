import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyTasAccess();
    const teachers = await prisma.teacher.findMany({
      where: { teachingLoad: { some: {} } },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(teachers.map(t => ({ teacherId: t.id, name: t.user.name })));
  } catch {
    return Response.json({ error: "Gagal memuat daftar guru" }, { status: 500 });
  }
}
