import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

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

    if (session.role !== "ADMIN") {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
      });
      const isKepsek = teacher?.jabatan.some(j => j.jabatan.name === "Kepala Sekolah") ?? false;
      if (!isKepsek) return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Kehadiran siswa 30 hari terakhir
    const attendance = await prisma.attendance.findMany({
      where: { date: { gte: since } },
      select: { date: true, status: true },
    });
    const totalAtt = attendance.length;
    const hadirCount = attendance.filter(a => a.status === "HADIR").length;
    const attendancePct = totalAtt > 0 ? Math.round((hadirCount / totalAtt) * 100) : 0;
    const byDay = new Map<string, { hadir: number; total: number }>();
    for (const a of attendance) {
      const key = a.date.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { hadir: 0, total: 0 };
      entry.total += 1;
      if (a.status === "HADIR") entry.hadir += 1;
      byDay.set(key, entry);
    }
    const attendanceTrend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, pct: v.total > 0 ? Math.round((v.hadir / v.total) * 100) : 0 }));

    // Status PKL
    const internships = await prisma.internship.findMany({ select: { status: true, company: true } });
    const pklByStatus = {
      ONGOING: internships.filter(i => i.status === "ONGOING").length,
      COMPLETED: internships.filter(i => i.status === "COMPLETED").length,
      CANCELLED: internships.filter(i => i.status === "CANCELLED").length,
    };
    const companyCounts = new Map<string, number>();
    for (const i of internships) companyCounts.set(i.company, (companyCounts.get(i.company) ?? 0) + 1);
    const topCompanies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([company, count]) => ({ company, count }));

    // Capaian akademik per jurusan (semester berjalan)
    const semester = currentSemester();
    const grades = await prisma.grade.findMany({
      where: { semester },
      select: { score: true, student: { select: { major: { select: { name: true } } } } },
    });
    const byMajor = new Map<string, { total: number; count: number }>();
    for (const g of grades) {
      const majorName = g.student.major.name;
      const entry = byMajor.get(majorName) ?? { total: 0, count: 0 };
      entry.total += g.score;
      entry.count += 1;
      byMajor.set(majorName, entry);
    }
    const academicByMajor = [...byMajor.entries()]
      .map(([major, v]) => ({ major, avg: Math.round((v.total / v.count) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);

    return Response.json({
      attendancePct,
      attendanceTrend,
      pklByStatus,
      topCompanies,
      academicByMajor,
      semester,
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
