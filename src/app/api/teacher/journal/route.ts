import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

async function getTeacherId(email: string) {
  const teacher = await prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
  return teacher?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacherId = await getTeacherId(session.email);
    if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const subject = searchParams.get("subject");
    const dateStr = searchParams.get("date");
    if (!classId || !subject || !dateStr) {
      return Response.json({ error: "classId, subject, date wajib diisi" }, { status: 400 });
    }

    // Wajib divalidasi: classId+subject di sini datang dari client (query param), tanpa cek ini
    // guru manapun bisa lihat roster+absensi kelas siapa saja lewat tebak-tebak classId (IDOR) —
    // pola sama seperti yang pernah kejadian nyata di /api/teacher/attendance & /api/teacher/students.
    const assignment = await prisma.teachingAssignment.findFirst({
      where: { teacherId, classId, subject: { name: subject } },
    });
    if (!assignment) return Response.json({ error: "Anda tidak mengajar kelas/mapel ini" }, { status: 403 });

    const date = new Date(dateStr);
    const nextDay = new Date(date.getTime() + 86400000);

    const [students, journal, attendance] = await Promise.all([
      prisma.student.findMany({
        where: { classId, studentStatus: "AKTIF" },
        select: { id: true, nis: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.teachingJournal.findFirst({
        where: { teacherId, classId, subject, date: { gte: date, lt: nextDay } },
        include: { entries: true },
      }),
      prisma.attendance.findMany({
        where: { student: { classId }, date: { gte: date, lt: nextDay } },
        select: { studentId: true, status: true },
      }),
    ]);

    const entryMap = new Map((journal?.entries ?? []).map(e => [e.studentId, e]));
    const attMap = new Map(attendance.map(a => [a.studentId, a.status]));

    const rows = students.map(s => {
      const e = entryMap.get(s.id);
      return {
        studentId: s.id,
        nis: s.nis,
        name: s.user.name,
        attendanceStatus: attMap.get(s.id) ?? "HADIR",
        scorePengetahuan: e?.scorePengetahuan ?? null,
        scoreKeterampilan: e?.scoreKeterampilan ?? null,
        catatan: e?.catatan ?? "",
      };
    });

    return Response.json({ journalId: journal?.id ?? null, materi: journal?.materi ?? "", rows });
  } catch {
    return Response.json({ error: "Gagal memuat jurnal" }, { status: 500 });
  }
}

interface JournalRowInput {
  studentId: string;
  attendanceStatus: string;
  scorePengetahuan: number | null;
  scoreKeterampilan: number | null;
  catatan: string;
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacherId = await getTeacherId(session.email);
    if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    const body = await req.json() as {
      classId: string; subject: string; date: string; semester: string; materi: string; rows: JournalRowInput[];
    };
    const { classId, subject, semester, materi } = body;
    const rows = body.rows ?? [];
    const date = new Date(body.date);
    const nextDay = new Date(date.getTime() + 86400000);

    const assignment = await prisma.teachingAssignment.findFirst({
      where: { teacherId, classId, subject: { name: subject } },
    });
    if (!assignment) return Response.json({ error: "Anda tidak mengajar kelas/mapel ini" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      await tx.teachingJournal.deleteMany({ where: { teacherId, classId, subject, date: { gte: date, lt: nextDay } } });
      await tx.teachingJournal.create({
        data: {
          teacherId, classId, subject, date, semester, materi,
          entries: {
            create: rows.map(r => ({
              studentId: r.studentId,
              scorePengetahuan: r.scorePengetahuan,
              scoreKeterampilan: r.scoreKeterampilan,
              catatan: r.catatan || null,
            })),
          },
        },
      });

      for (const r of rows) {
        await tx.attendance.deleteMany({ where: { studentId: r.studentId, date: { gte: date, lt: nextDay } } });
        await tx.attendance.create({ data: { studentId: r.studentId, date, status: r.attendanceStatus } });
      }
    });

    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan jurnal" }, { status: 500 });
  }
}
