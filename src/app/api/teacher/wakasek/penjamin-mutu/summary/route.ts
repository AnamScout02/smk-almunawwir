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
    await assertJabatan(session, ["Wakil Kepala Bidang Penjamin Mutu"]);

    const semester = currentSemester();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [grades, attendance, gradeTwelve, noGenderStudents, noGenderTeachers, unclassedStudents] = await Promise.all([
      getJournalGradeAggregates({ semester }),
      prisma.attendance.findMany({
        where: { date: { gte: since }, student: { studentStatus: "AKTIF" } },
        select: { status: true },
      }),
      prisma.student.findMany({
        where: { studentStatus: "AKTIF", class: { grade: 12 } },
        select: { id: true, internship: { select: { status: true } } },
      }),
      prisma.student.count({ where: { studentStatus: "AKTIF", gender: null } }),
      prisma.teacher.count({ where: { gender: null } }),
      prisma.student.count({ where: { studentStatus: "AKTIF", classId: null } }),
    ]);

    const gradedRows = grades.filter((g): g is typeof g & { avg: number } => g.avg !== null);
    const schoolAvg = gradedRows.length ? Math.round((gradedRows.reduce((a, g) => a + g.avg, 0) / gradedRows.length) * 10) / 10 : null;

    const hadir = attendance.filter(a => a.status === "HADIR").length;
    const attendanceRate = attendance.length > 0 ? Math.round((hadir / attendance.length) * 100) : null;

    const placed = gradeTwelve.filter(s => s.internship && ["ONGOING", "COMPLETED"].includes(s.internship.status)).length;
    const pklRate = gradeTwelve.length > 0 ? Math.round((placed / gradeTwelve.length) * 100) : null;

    const dataGaps = [
      { label: "Siswa belum ada Jenis Kelamin", count: noGenderStudents, href: "/dashboard/admin/buku-induk/siswa" },
      { label: "Guru belum ada Jenis Kelamin", count: noGenderTeachers, href: "/dashboard/admin/buku-induk/guru" },
      { label: "Siswa belum punya Kelas", count: unclassedStudents, href: "/dashboard/admin/buku-induk/siswa" },
    ].filter(g => g.count > 0);

    return Response.json({
      schoolAvg, attendanceRate, pklRate,
      totalGaps: dataGaps.reduce((a, g) => a + g.count, 0),
      dataGaps, semester,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Bidang Penjamin Mutu." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
