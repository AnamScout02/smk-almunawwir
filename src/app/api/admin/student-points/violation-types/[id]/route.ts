import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    const { category, name, pointsMin, pointsMax, piketAllowed, active } = await req.json();
    if (!category?.trim() || !name?.trim() || typeof pointsMin !== "number" || typeof pointsMax !== "number") {
      return Response.json({ error: "Kategori, nama, dan rentang poin wajib diisi" }, { status: 400 });
    }
    if (pointsMin < 0 || pointsMax < pointsMin) {
      return Response.json({ error: "Rentang poin tidak valid" }, { status: 400 });
    }
    const type = await prisma.studentViolationType.update({
      where: { id },
      data: { category: category.trim(), name: name.trim(), pointsMin, pointsMax, piketAllowed: !!piketAllowed, active: active ?? true },
    });
    return Response.json(type);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal mengubah jenis pelanggaran" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    const used = await prisma.studentPointRecord.count({ where: { violationTypeId: id } });
    if (used > 0) {
      // Sudah pernah dipakai mencatat siswa — nonaktifkan saja, jangan hapus (jaga histori tetap utuh).
      const type = await prisma.studentViolationType.update({ where: { id }, data: { active: false } });
      return Response.json({ deactivated: true, type });
    }
    await prisma.studentViolationType.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus jenis pelanggaran" }, { status: 500 });
  }
}
