import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

const KAPROGLI_PREFIX = "Kepala Kompetensi Keahlian ";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);

    let majorCodes: string[];
    if (session.role === "ADMIN") {
      majorCodes = (await prisma.major.findMany({ select: { code: true } })).map(m => m.code);
    } else {
      const names = await getJabatanNames(session.email);
      majorCodes = names.filter(n => n.startsWith(KAPROGLI_PREFIX)).map(n => n.slice(KAPROGLI_PREFIX.length));
      if (majorCodes.length === 0) return Response.json({ error: "Khusus Kepala Kompetensi Keahlian." }, { status: 403 });
    }

    const majors = await prisma.major.findMany({ where: { code: { in: majorCodes } }, select: { id: true, name: true, code: true } });
    const semester = currentSemester();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const result = await Promise.all(majors.map(async (major) => {
      const classes = await prisma.class.findMany({
        where: { majorId: major.id },
        select: { id: true, name: true, students: { where: { studentStatus: "AKTIF" }, select: { id: true } } },
      });
      const studentIds = classes.flatMap(c => c.students.map(s => s.id));

      const [grades, attendance, internships] = await Promise.all([
        prisma.grade.findMany({ where: { semester, studentId: { in: studentIds } }, select: { studentId: true, score: true } }),
        prisma.attendance.findMany({ where: { date: { gte: since }, studentId: { in: studentIds } }, select: { studentId: true, status: true } }),
        prisma.internship.findMany({ where: { studentId: { in: studentIds } }, select: { status: true } }),
      ]);

      const gradesByStudent = new Map<string, number[]>();
      for (const g of grades) gradesByStudent.set(g.studentId, [...(gradesByStudent.get(g.studentId) ?? []), g.score]);
      const attByStudent = new Map<string, { hadir: number; total: number }>();
      for (const a of attendance) {
        const e = attByStudent.get(a.studentId) ?? { hadir: 0, total: 0 };
        e.total += 1; if (a.status === "HADIR") e.hadir += 1;
        attByStudent.set(a.studentId, e);
      }

      const classStats = classes.map(c => {
        const ids = c.students.map(s => s.id);
        const allScores = ids.flatMap(id => gradesByStudent.get(id) ?? []);
        const avg = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;
        let hadir = 0, total = 0;
        for (const id of ids) { const e = attByStudent.get(id); if (e) { hadir += e.hadir; total += e.total; } }
        const attPct = total > 0 ? Math.round((hadir / total) * 100) : null;
        return { className: c.name, avg, attPct, studentCount: ids.length };
      });

      const pklByStatus = {
        ONGOING: internships.filter(i => i.status === "ONGOING").length,
        COMPLETED: internships.filter(i => i.status === "COMPLETED").length,
        CANCELLED: internships.filter(i => i.status === "CANCELLED").length,
      };

      return { majorId: major.id, majorName: major.name, majorCode: major.code, classStats, pklByStatus, totalStudents: studentIds.length };
    }));

    return Response.json({ majors: result, semester });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
