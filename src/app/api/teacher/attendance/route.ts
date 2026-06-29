import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    const where: Record<string, unknown> = {};
    if (classId) where.student = { classId };
    if (date) where.date = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };

    const records = await prisma.attendance.findMany({
      where,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    });
    return Response.json(records);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["TEACHER", "ADMIN"]);
    const { records } = await req.json();

    type AttRecord = { studentId: string; date: string; status: string };

    await prisma.$transaction(async (tx) => {
      for (const r of records as AttRecord[]) {
        const date = new Date(r.date);
        const nextDay = new Date(date.getTime() + 86400000);
        await tx.attendance.deleteMany({
          where: { studentId: r.studentId, date: { gte: date, lt: nextDay } },
        });
        await tx.attendance.create({
          data: { studentId: r.studentId, date, status: r.status },
        });
      }
    });

    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
