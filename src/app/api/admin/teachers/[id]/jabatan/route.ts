import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id: teacherId } = await params;
    const { jabatanIds } = await req.json();
    if (!Array.isArray(jabatanIds)) {
      return Response.json({ error: "Data jabatan tidak valid." }, { status: 400 });
    }

    const before = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { user: { select: { name: true } }, jabatan: { select: { jabatan: { select: { name: true } } } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.teacherJabatan.deleteMany({ where: { teacherId } });
      if (jabatanIds.length > 0) {
        await tx.teacherJabatan.createMany({
          data: jabatanIds.map((jabatanId: string) => ({ teacherId, jabatanId })),
        });
      }
    });

    const afterNames = await prisma.jabatan.findMany({ where: { id: { in: jabatanIds } }, select: { name: true } });
    const beforeNames = before?.jabatan.map(j => j.jabatan.name) ?? [];
    await logActivity(session, {
      action: "UPDATE_JABATAN", entity: "Teacher", entityId: teacherId,
      description: `${session.name} mengubah jabatan "${before?.user.name ?? teacherId}" dari [${beforeNames.join(", ") || "—"}] menjadi [${afterNames.map(j => j.name).join(", ") || "—"}]`,
      metadata: { before: beforeNames, after: afterNames.map(j => j.name) },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menyimpan jabatan." }, { status: 500 });
  }
}
