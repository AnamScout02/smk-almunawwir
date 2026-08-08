import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { getJournalGradeAggregates } from "@/lib/journal-grades";

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Wakil Kepala Kurikulum"]);

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [assignments, recentJournals, semesterGrades, classes] = await Promise.all([
      prisma.teachingAssignment.findMany({
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      }),
      prisma.teachingJournal.findMany({
        where: { date: { gte: since } },
        select: { teacherId: true, classId: true, subject: true },
      }),
      getJournalGradeAggregates({ semester: currentSemester() }),
      prisma.class.findMany({
        select: { id: true, name: true, grade: true, _count: { select: { schedules: true } } },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      }),
    ]);

    const journalSet = new Set(recentJournals.map(j => `${j.teacherId}::${j.classId}::${j.subject}`));
    const missingJournal = assignments
      .filter(a => !journalSet.has(`${a.teacherId}::${a.classId}::${a.subject.name}`))
      .map(a => ({ teacherName: a.teacher.user.name, className: a.class.name, subject: a.subject.name }));

    const gradedRows = semesterGrades.filter((g): g is typeof g & { avg: number } => g.avg !== null);

    const bySubject = new Map<string, { total: number; count: number }>();
    for (const g of gradedRows) {
      const e = bySubject.get(g.subject) ?? { total: 0, count: 0 };
      e.total += g.avg; e.count += 1;
      bySubject.set(g.subject, e);
    }
    const avgBySubject = [...bySubject.entries()]
      .map(([subject, v]) => ({ subject, avg: Math.round((v.total / v.count) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);

    const schoolAvg = gradedRows.length
      ? Math.round((gradedRows.reduce((a, g) => a + g.avg, 0) / gradedRows.length) * 10) / 10
      : null;

    const classesWithoutSchedule = classes.filter(c => c._count.schedules === 0)
      .map(c => ({ id: c.id, name: c.name, grade: c.grade }));

    return Response.json({
      missingJournal,
      avgBySubject,
      schoolAvg,
      classesWithoutSchedule,
      totalAssignments: assignments.length,
      semester: currentSemester(),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
