import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const adminTeacherId = searchParams.get("teacherId");

    let teacherId: string | null = null;
    if ((session.role === "ADMIN" || session.role === "TAS") && adminTeacherId) {
      teacherId = adminTeacherId;
    } else {
      const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
      teacherId = teacher?.id ?? null;
    }
    if (!teacherId) return Response.json([]);

    const classId = searchParams.get("classId");
    const subject = searchParams.get("subject");
    const semester = searchParams.get("semester");
    const month = searchParams.get("month"); // format YYYY-MM

    const where: Record<string, unknown> = { teacherId };
    if (classId) where.classId = classId;
    if (subject) where.subject = subject;
    if (semester) where.semester = semester;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.date = { gte: start, lt: end };
    }

    // Kehadiran H/I/S/A di rekap ini dihitung dari JournalEntry.attendanceStatus milik jurnal itu
    // sendiri (pegangan guru mapel), BUKAN dari tabel Attendance (absensi resmi kelas) — dua alur
    // ini sudah sengaja dipisah, lihat komentar di /api/teacher/journal.
    const journals = await prisma.teachingJournal.findMany({
      where,
      include: {
        class: { select: { name: true } },
        entries: { select: { scorePengetahuan: true, scoreKeterampilan: true, catatan: true, studentId: true, attendanceStatus: true } },
      },
      orderBy: { date: "asc" },
    });

    const result = journals.map(j => {
      const count = (status: string) => j.entries.filter(e => e.attendanceStatus === status).length;
      const scoresP = j.entries.map(e => e.scorePengetahuan).filter((v): v is number => v !== null);
      const scoresK = j.entries.map(e => e.scoreKeterampilan).filter((v): v is number => v !== null);
      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
      const catatanList = j.entries.filter(e => e.catatan).length;
      return {
        id: j.id,
        date: j.date,
        className: j.class.name,
        subject: j.subject,
        materi: j.materi,
        hadir: count("HADIR"), izin: count("IZIN"), sakit: count("SAKIT"), alpha: count("ALPHA"),
        avgPengetahuan: avg(scoresP), avgKeterampilan: avg(scoresK),
        catatanCount: catatanList,
      };
    });

    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal memuat riwayat jurnal" }, { status: 500 });
  }
}
