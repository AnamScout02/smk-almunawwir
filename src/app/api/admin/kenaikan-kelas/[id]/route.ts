import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true, grade: true } }, major: { select: { code: true } } } },
  academicYear: { select: { id: true, name: true } },
} as const;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if ("fromClass" in b) data.fromClass = b.fromClass?.trim() || null;
    if ("toClass" in b) data.toClass = b.toClass?.trim() || null;
    if ("decision" in b) data.decision = b.decision;
    if ("reason" in b) data.reason = b.reason?.trim() || null;
    if ("decidedAt" in b) data.decidedAt = b.decidedAt ? new Date(b.decidedAt) : new Date();
    if ("notes" in b) data.notes = b.notes?.trim() || null;
    const row = await prisma.promotionDecision.update({ where: { id }, data, include });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui keputusan." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.promotionDecision.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus keputusan." }, { status: 500 });
  }
}
