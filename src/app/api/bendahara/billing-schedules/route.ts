import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const schedules = await prisma.billingSchedule.findMany({
      include: { feeType: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }],
    });
    return Response.json(schedules);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal memuat jadwal tagihan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { name, feeTypeId, classId, periodType, startDate, frequency, dueDateOffsetDays, notes } = await req.json();
    if (!name?.trim() || !feeTypeId || !periodType || !startDate) {
      return Response.json({ error: "Nama, jenis biaya, periode, dan tanggal mulai wajib diisi" }, { status: 400 });
    }
    if (!["MONTHLY", "DAILY"].includes(periodType)) {
      return Response.json({ error: "Periode tidak valid" }, { status: 400 });
    }
    const freq = Number(frequency);
    if (!freq || freq < 1 || freq > 500) {
      return Response.json({ error: "Frekuensi harus antara 1-500" }, { status: 400 });
    }
    const offset = Number(dueDateOffsetDays) || 0;
    if (offset < 0) return Response.json({ error: "Jatuh tempo tidak valid" }, { status: 400 });

    const schedule = await prisma.billingSchedule.create({
      data: {
        name: name.trim(), feeTypeId, classId: classId || null, periodType,
        startDate: new Date(startDate), frequency: freq, dueDateOffsetDays: offset,
        notes: notes || null, createdByName: session.name,
      },
      include: { feeType: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
    });
    return Response.json(schedule, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal membuat jadwal tagihan" }, { status: 500 });
  }
}
