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

    const result = await Promise.all(majors.map(async (major) => {
      const students = await prisma.student.findMany({
        where: { majorId: major.id, studentStatus: "AKTIF", class: { grade: 12 } },
        select: {
          id: true, nis: true,
          user: { select: { name: true } },
          class: { select: { name: true } },
          grades: { where: { type: "UKK" }, select: { score: true, semester: true } },
        },
      });

      const studentRows = students.map(s => {
        const scores = s.grades.map(g => g.score);
        const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
        return { studentId: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—", score: avg };
      });

      const withScore = studentRows.filter(r => r.score !== null);
      const classAvg = withScore.length ? Math.round((withScore.reduce((a, r) => a + (r.score ?? 0), 0) / withScore.length) * 10) / 10 : null;

      return {
        majorId: major.id, majorName: major.name, majorCode: major.code,
        students: studentRows, classAvg,
        completedCount: withScore.length, totalCount: studentRows.length,
      };
    }));

    return Response.json({ majors: result, semester });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
