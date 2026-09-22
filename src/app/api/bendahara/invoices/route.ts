import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { logActivity } from "@/lib/activity-log";

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const period = searchParams.get("period"); // "YYYY-MM", exact match

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(period ? { period } : {}),
        ...(classId ? { student: { classId } } : {}),
      },
      include: {
        student: { include: { user: { select: { name: true } }, class: { select: { id: true, name: true } } } },
        feeType: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return Response.json(invoices);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal memuat tagihan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { studentId, feeTypeId, period, amount, dueDate } = await req.json();
    if (!studentId || !feeTypeId || !period?.trim() || typeof amount !== "number" || amount < 0) {
      return Response.json({ error: "Siswa, jenis biaya, periode, dan jumlah wajib diisi dengan benar" }, { status: 400 });
    }
    const existing = await prisma.invoice.findUnique({
      where: { studentId_feeTypeId_period: { studentId, feeTypeId, period: period.trim() } },
    });
    if (existing) {
      return Response.json({ error: "Siswa ini sudah punya tagihan jenis & periode yang sama — edit tagihan yang sudah ada, bukan buat baru." }, { status: 409 });
    }
    const invoice = await prisma.invoice.create({
      data: {
        studentId, feeTypeId, period: period.trim(), amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        recordedByName: session.name,
      },
      include: { student: { include: { user: { select: { name: true } } } }, feeType: { select: { name: true } } },
    });
    await logActivity(session, {
      action: "CREATE_INVOICE", entity: "Invoice", entityId: invoice.id,
      description: `${session.name} membuat tagihan "${invoice.feeType.name}" (${invoice.period}) untuk ${invoice.student.user.name}`,
    });
    return Response.json(invoice, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal membuat tagihan" }, { status: 500 });
  }
}
