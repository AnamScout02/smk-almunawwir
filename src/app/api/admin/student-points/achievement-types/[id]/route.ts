import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    const { name, pointsMin, pointsMax, active } = await req.json();
    if (!name?.trim() || typeof pointsMin !== "number" || typeof pointsMax !== "number") {
      return Response.json({ error: "Nama dan rentang poin wajib diisi" }, { status: 400 });
    }
    if (pointsMin < 0 || pointsMax < pointsMin) {
      return Response.json({ error: "Rentang poin tidak valid" }, { status: 400 });
    }
    const type = await prisma.studentAchievementType.update({
      where: { id },
      data: { name: name.trim(), pointsMin, pointsMax, active: active ?? true },
    });
    return Response.json(type);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal mengubah jenis prestasi" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    const used = await prisma.studentPointRecord.count({ where: { achievementTypeId: id } });
    if (used > 0) {
      const type = await prisma.studentAchievementType.update({ where: { id }, data: { active: false } });
      return Response.json({ deactivated: true, type });
    }
    await prisma.studentAchievementType.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus jenis prestasi" }, { status: 500 });
  }
}
