import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

// Absensi resmi KHUSUS wali kelas (per keputusan terbaru, membalik kebijakan lama) — guru mapel
// biasa yang cuma punya TeachingAssignment (bukan wali kelas) TIDAK lagi boleh input di sini.
// Kalau guru mapel perlu catat kehadiran per pertemuan mapelnya sendiri, itu lewat kolom
// Kehadiran di Jurnal Mengajar (JournalEntry.attendanceStatus, terpisah & tidak menimpa tabel ini).
async function getAllowedClassIds(session: { role: string; email: string }): Promise<string[] | null> {
  if (session.role !== "TEACHER") return null;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: { homeroomOf: { select: { id: true } } },
  });
  return teacher?.homeroomOf.map(c => c.id) ?? [];
}

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    const allowedClassIds = await getAllowedClassIds(session);
    if (allowedClassIds !== null) {
      if (classId && !allowedClassIds.includes(classId)) {
        return Response.json({ error: "Anda tidak memiliki akses ke kelas ini" }, { status: 403 });
      }
      if (!classId && allowedClassIds.length === 0) return Response.json([]);
    }

    const where: Record<string, unknown> = {};
    if (classId) where.student = { classId };
    else if (allowedClassIds) where.student = { classId: { in: allowedClassIds } };
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
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { records } = await req.json();

    type AttRecord = { studentId: string; date: string; status: string };
    const list = records as AttRecord[];

    const allowedClassIds = await getAllowedClassIds(session);
    if (allowedClassIds !== null) {
      const studentIds = [...new Set(list.map(r => r.studentId))];
      const validCount = await prisma.student.count({
        where: { id: { in: studentIds }, classId: { in: allowedClassIds } },
      });
      if (validCount !== studentIds.length) {
        return Response.json({ error: "Anda tidak memiliki akses ke sebagian siswa ini" }, { status: 403 });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const r of list) {
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
