import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const body = await req.json();

    const ketuaKelasId = body.ketuaKelasId || null;
    const sekretarisId = body.sekretarisId || null;
    if (ketuaKelasId || sekretarisId) {
      const memberIds = [ketuaKelasId, sekretarisId].filter(Boolean) as string[];
      const members = await prisma.student.findMany({ where: { id: { in: memberIds }, classId: id }, select: { id: true } });
      if (members.length !== memberIds.length) {
        return Response.json({ error: "Ketua Kelas/Sekretaris harus siswa dari kelas ini" }, { status: 400 });
      }
    }

    const cls = await prisma.class.update({
      where: { id },
      data: {
        name: body.name,
        grade: Number(body.grade),
        majorId: body.majorId,
        homeroomId: body.homeroomId || null,
        ketuaKelasId,
        sekretarisId,
      },
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: {
          select: { id: true, nis: true, user: { select: { name: true } } },
          where: { studentStatus: "AKTIF" },
          orderBy: { user: { name: "asc" } },
        },
        ketuaKelas: { select: { id: true, user: { select: { name: true } } } },
        sekretaris: { select: { id: true, user: { select: { name: true } } } },
      },
    });
    return Response.json(cls);
  } catch {
    return Response.json({ error: "Gagal mengupdate kelas" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    await prisma.class.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus kelas. Pastikan tidak ada siswa di kelas ini." }, { status: 500 });
  }
}
