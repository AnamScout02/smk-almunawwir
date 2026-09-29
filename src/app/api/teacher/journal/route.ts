import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { pesanNilaiTerkunci } from "@/lib/rapor-verifikasi";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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

    // Kehadiran di sini murni pegangan guru mapel ITU SENDIRI (JournalEntry.attendanceStatus) —
    // TIDAK lagi baca/tulis Attendance (absensi resmi harian, punya wali kelas/ketua-sekretaris),
    // supaya dua alur ini tidak lagi rebutan/saling timpa.
    const [students, journal] = await Promise.all([
      prisma.student.findMany({
        where: { classId, studentStatus: "AKTIF" },
        select: { id: true, nis: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.teachingJournal.findFirst({
        where: { teacherId, classId, subject, date: { gte: date, lt: nextDay } },
        include: { entries: true },
      }),
    ]);

    const entryMap = new Map((journal?.entries ?? []).map(e => [e.studentId, e]));

    const rows = students.map(s => {
      const e = entryMap.get(s.id);
      return {
        studentId: s.id,
        nis: s.nis,
        name: s.user.name,
        // "" (bukan "HADIR") kalau belum pernah dicatat — jangan diam2 dianggap "Hadir" sebelum
        // guru benar2 memilih.
        attendanceStatus: e?.attendanceStatus ?? "",
        scorePengetahuan: e?.scorePengetahuan ?? null,
        scoreKeterampilan: e?.scoreKeterampilan ?? null,
        catatan: e?.catatan ?? "",
      };
    });

    return Response.json({ journalId: journal?.id ?? null, materi: journal?.materi ?? "", rows });
  } catch (e) {
    lemparBilaPengalihan(e);
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

    // Nilai yang sudah dikunci wali kelas untuk rapor tidak boleh berubah — cek semester yang disimpan DAN semester jurnal lama
    // pada tanggal itu (simpan ulang menghapus jurnal lama).
    const lama = await prisma.teachingJournal.findMany({ where: { teacherId, classId, subject, date: { gte: date, lt: nextDay } }, select: { semester: true } });
    const terkunci = await pesanNilaiTerkunci(classId, [semester, ...lama.map(j => j.semester)]);
    if (terkunci) return Response.json({ error: terkunci }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.teachingJournal.deleteMany({ where: { teacherId, classId, subject, date: { gte: date, lt: nextDay } } });
      await tx.teachingJournal.create({
        data: {
          teacherId, classId, subject, date, semester, materi,
          // attendanceStatus disimpan di JournalEntry sendiri — pegangan guru mapel ini saja,
          // TIDAK menyentuh tabel Attendance (absensi resmi harian kelas) sama sekali.
          entries: {
            create: rows.map(r => ({
              studentId: r.studentId,
              attendanceStatus: r.attendanceStatus || null,
              scorePengetahuan: r.scorePengetahuan,
              scoreKeterampilan: r.scoreKeterampilan,
              catatan: r.catatan || null,
            })),
          },
        },
      });
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan jurnal" }, { status: 500 });
  }
}
