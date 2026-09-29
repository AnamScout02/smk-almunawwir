import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
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
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat data kelas" }, { status: 500 });
  }
}
