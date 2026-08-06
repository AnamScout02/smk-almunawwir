import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const cls = await prisma.class.findUnique({
      where: { id },
      select: {
        id: true, name: true, grade: true,
        major: { select: { name: true } },
        homeroom: { select: { user: { select: { name: true } } } },
        students: {
          where: { studentStatus: "AKTIF" },
          select: { id: true, nis: true, nisn: true, gender: true, user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
    });
    if (!cls) return Response.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    return Response.json(cls);
  } catch {
    return Response.json({ error: "Gagal memuat data kelas" }, { status: 500 });
  }
}
