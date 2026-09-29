import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (session.role === "ADMIN" || session.role === "TAS") {
      const assignments = await prisma.teachingAssignment.findMany({
        select: {
          classId: true,
          class: { select: { name: true, grade: true } },
          subjectId: true,
          subject: { select: { name: true } },
          teacherId: true,
          teacher: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ class: { grade: "asc" } }, { class: { name: "asc" } }],
      });
      const seen = new Set<string>();
      const result = [];
      for (const a of assignments) {
        const key = `${a.classId}::${a.subject.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          classId: a.classId, className: a.class.name, grade: a.class.grade,
          subjectId: a.subjectId, subjectName: a.subject.name,
          teacherId: a.teacherId, teacherName: a.teacher.user.name,
        });
      }
      return Response.json(result);
    }

    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: { id: true },
    });
    if (!teacher) return Response.json([]);

    // Kalau tanggal dikirim, filter cuma kelas+mapel yang BENAR-BENAR terjadwal hari itu (day +
    // rotasi minggu A/B) — supaya guru tidak perlu scroll semua Penugasan Mengajarnya, cukup yang
    // relevan hari ini. Tanpa tanggal (fallback lama), tampilkan semua Penugasan Mengajar.
    if (dateStr) {
      const date = new Date(dateStr);
      const day = DAYS[date.getDay()];
      const weekType = await getWeekTypeForDate(date);

      const [schedules, assignments] = await Promise.all([
        prisma.schedule.findMany({
          where: { teacherId: teacher.id, day },
          select: { classId: true, subject: true, weekType: true, class: { select: { name: true, grade: true } } },
        }),
        prisma.teachingAssignment.findMany({
          where: { teacherId: teacher.id },
          select: { classId: true, subjectId: true, subject: { select: { name: true } } },
        }),
      ]);
      const subjectIdMap = new Map(assignments.map(a => [`${a.classId}::${a.subject.name}`, a.subjectId]));

      const seen = new Set<string>();
      const result = [];
      for (const s of schedules.filter(s => weekTypesOverlap(s.weekType, weekType))) {
        const key = `${s.classId}::${s.subject}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          classId: s.classId, className: s.class.name, grade: s.class.grade,
          subjectId: subjectIdMap.get(key) ?? "", subjectName: s.subject,
        });
      }
      return Response.json(result);
    }

    const assignments = await prisma.teachingAssignment.findMany({
      where: { teacherId: teacher.id },
      select: {
        classId: true,
        class: { select: { name: true, grade: true } },
        subjectId: true,
        subject: { select: { name: true } },
      },
      orderBy: [{ class: { grade: "asc" } }, { class: { name: "asc" } }],
    });

    return Response.json(assignments.map(a => ({
      classId: a.classId,
      className: a.class.name,
      grade: a.class.grade,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
    })));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
