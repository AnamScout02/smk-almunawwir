import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

const ALPHA_WATCH_THRESHOLD = 3;

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Wakil Kepala Kesiswaan"]);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      select: {
        id: true, nis: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        attendance: { where: { date: { gte: since } }, select: { status: true } },
      },
    });

    const statusCount = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    for (const s of students) {
      for (const a of s.attendance) {
        if (a.status in statusCount) statusCount[a.status as keyof typeof statusCount]++;
      }
    }
    const totalRecords = statusCount.HADIR + statusCount.IZIN + statusCount.SAKIT + statusCount.ALPHA;
    const attendanceRate = totalRecords > 0 ? Math.round((statusCount.HADIR / totalRecords) * 100) : null;

    const byClass = new Map<string, { hadir: number; total: number }>();
    for (const s of students) {
      const className = s.class?.name ?? "Tanpa Kelas";
      const entry = byClass.get(className) ?? { hadir: 0, total: 0 };
      entry.total += s.attendance.length;
      entry.hadir += s.attendance.filter(a => a.status === "HADIR").length;
      byClass.set(className, entry);
    }
    const classRanking = Array.from(byClass.entries())
      .filter(([, v]) => v.total > 0)
      .map(([className, v]) => ({ className, rate: Math.round((v.hadir / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate);

    const watchList = students
      .map(s => ({
        studentId: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—",
        alphaCount: s.attendance.filter(a => a.status === "ALPHA").length,
      }))
      .filter(s => s.alphaCount >= ALPHA_WATCH_THRESHOLD)
      .sort((a, b) => b.alphaCount - a.alphaCount);

    return Response.json({
      attendanceRate, totalAlpha: statusCount.ALPHA, watchListCount: watchList.length,
      statusCount, classRanking, watchList,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Kesiswaan." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
