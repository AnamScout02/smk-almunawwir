import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

const ATTENDANCE_THRESHOLD = 75;
const GRADE_THRESHOLD = 75;

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Guru BK"]);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const semester = currentSemester();

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      select: {
        id: true, nis: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        attendance: { where: { date: { gte: since } }, select: { status: true } },
        grades: { where: { semester }, select: { score: true } },
      },
    });

    const rows = students.map(s => {
      const totalAtt = s.attendance.length;
      const hadir = s.attendance.filter(a => a.status === "HADIR").length;
      const attPct = totalAtt > 0 ? Math.round((hadir / totalAtt) * 100) : null;
      const avgScore = s.grades.length ? Math.round((s.grades.reduce((a, g) => a + g.score, 0) / s.grades.length) * 10) / 10 : null;

      const reasons: string[] = [];
      if (attPct !== null && attPct < ATTENDANCE_THRESHOLD) reasons.push("Kehadiran Rendah");
      if (avgScore !== null && avgScore < GRADE_THRESHOLD) reasons.push("Nilai Rendah");

      return {
        studentId: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—",
        attPct, avgScore, reasons,
      };
    }).filter(r => r.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length);

    return Response.json({
      students: rows,
      lowAttendanceCount: rows.filter(r => r.reasons.includes("Kehadiran Rendah")).length,
      lowGradeCount: rows.filter(r => r.reasons.includes("Nilai Rendah")).length,
      bothCount: rows.filter(r => r.reasons.length === 2).length,
      semester,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Guru BK." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
