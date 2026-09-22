import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
  academicYear: { select: { id: true, name: true } },
} as const;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if ("studentId" in b) data.studentId = b.studentId;
    if ("academicYearId" in b) data.academicYearId = b.academicYearId || null;
    if ("semester" in b) data.semester = b.semester;
    if ("tanggalAmbil" in b) data.tanggalAmbil = b.tanggalAmbil ? new Date(b.tanggalAmbil) : new Date();
    if ("diambilOleh" in b) data.diambilOleh = String(b.diambilOleh).trim();
    if ("hubungan" in b) data.hubungan = b.hubungan?.trim() || null;
    if ("phone" in b) data.phone = b.phone?.trim() || null;
    if ("catatan" in b) data.catatan = b.catatan?.trim() || null;
    const row = await prisma.raporHandover.update({ where: { id }, data, include });
    return Response.json(row);
  } catch {
    return Response.json({ error: "Gagal memperbarui data." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.raporHandover.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus data." }, { status: 500 });
  }
}
