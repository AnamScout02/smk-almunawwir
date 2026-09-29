import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { logActivity } from "@/lib/activity-log";
import { formatRupiah } from "@/lib/currency";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    const { amount, dueDate, paidAmount, paidAt, paymentMethod, notes } = await req.json();
    if (typeof amount !== "number" || amount < 0 || typeof paidAmount !== "number" || paidAmount < 0) {
      return Response.json({ error: "Jumlah tagihan/dibayar tidak valid" }, { status: 400 });
    }

    const before = await prisma.invoice.findUnique({
      where: { id },
      include: { student: { include: { user: { select: { name: true } } } }, feeType: { select: { name: true } } },
    });
    if (!before) return Response.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAmount,
        paidAt: paidAt ? new Date(paidAt) : null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
      },
    });

    if (paidAmount !== before.paidAmount) {
      await logActivity(session, {
        action: "MARK_INVOICE_PAID", entity: "Invoice", entityId: id,
        description: `${session.name} mencatat pembayaran ${formatRupiah(paidAmount)} untuk tagihan "${before.feeType.name}" (${before.period}) ${before.student.user.name}`,
        metadata: { before: before.paidAmount, after: paidAmount },
      });
    } else {
      await logActivity(session, {
        action: "UPDATE_INVOICE", entity: "Invoice", entityId: id,
        description: `${session.name} mengubah tagihan "${before.feeType.name}" (${before.period}) ${before.student.user.name}`,
      });
    }
    return Response.json(invoice);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal mengubah tagihan" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    const invoice = await prisma.invoice.delete({
      where: { id },
      include: { student: { include: { user: { select: { name: true } } } }, feeType: { select: { name: true } } },
    });
    await logActivity(session, {
      action: "DELETE_INVOICE", entity: "Invoice", entityId: id,
      description: `${session.name} menghapus tagihan "${invoice.feeType.name}" (${invoice.period}) ${invoice.student.user.name}`,
    });
    return Response.json({ deleted: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus tagihan" }, { status: 500 });
  }
}
