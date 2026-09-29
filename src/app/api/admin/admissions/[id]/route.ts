import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const body = await req.json();
    const before = await prisma.admission.findUnique({ where: { id }, select: { status: true, fullName: true } });
    const item = await prisma.admission.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.jalur !== undefined ? { jalur: body.jalur } : {}),
        ...(body.nilaiRapor !== undefined ? { nilaiRapor: body.nilaiRapor === "" ? null : Number(body.nilaiRapor) } : {}),
        ...(body.nilaiTes !== undefined ? { nilaiTes: body.nilaiTes === "" ? null : Number(body.nilaiTes) } : {}),
        ...(body.skorAkhir !== undefined ? { skorAkhir: body.skorAkhir === "" ? null : Number(body.skorAkhir) } : {}),
        ...(body.paymentVerified !== undefined ? { paymentVerified: !!body.paymentVerified } : {}),
      },
    });

    if (body.status !== undefined && before && before.status !== body.status) {
      await logActivity(session, {
        action: "DECIDE_ADMISSION", entity: "Admission", entityId: id,
        description: `${session.name} mengubah status pendaftar "${before.fullName}" dari ${before.status} menjadi ${body.status}`,
        metadata: { before: before.status, after: body.status },
      });
    }

    return Response.json(item);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const admission = await prisma.admission.delete({ where: { id } });
    await logActivity(session, {
      action: "DELETE_ADMISSION", entity: "Admission", entityId: id,
      description: `${session.name} menghapus data pendaftar "${admission.fullName}"`,
    });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
