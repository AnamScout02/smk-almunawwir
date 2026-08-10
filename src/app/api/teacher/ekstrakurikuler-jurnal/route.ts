import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertExtracurricularAccess } from "@/lib/ekstrakurikuler-guard";

async function getTeacherId(email: string) {
  const teacher = await prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
  return teacher?.id ?? null;
}

/** Absen Ekstra (Pramuka, dst) — per sesi ekstrakurikuler, TERPISAH dari Attendance resmi
 * (absensi harian sekolah), sama seperti Jurnal Mengajar terpisah dari Attendance. Roster dari
 * ExtracurricularMember (peserta ekskul), bukan Class. Khusus Pembina ekskul ybs. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacherId = await getTeacherId(session.email);
    if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const extracurricularId = searchParams.get("extracurricularId");
    const dateStr = searchParams.get("date");
    if (!extracurricularId || !dateStr) return Response.json({ error: "extracurricularId dan date wajib diisi" }, { status: 400 });

    const ekskul = await prisma.extracurricular.findUnique({ where: { id: extracurricularId } });
    if (!ekskul) return Response.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    const date = new Date(dateStr);
    const nextDay = new Date(date.getTime() + 86400000);

    const [members, journal] = await Promise.all([
      prisma.extracurricularMember.findMany({
        where: { extracurricularId },
        include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: { student: { user: { name: "asc" } } },
      }),
      prisma.extracurricularJournal.findFirst({
        where: { extracurricularId, date: { gte: date, lt: nextDay } },
        include: { entries: true },
      }),
    ]);

    const entryMap = new Map((journal?.entries ?? []).map(e => [e.studentId, e]));
    const rows = members.map(m => {
      const e = entryMap.get(m.studentId);
      return {
        studentId: m.studentId, nis: m.student.nis, name: m.student.user.name, className: m.student.class?.name ?? "—",
        // "" (bukan "HADIR") kalau belum pernah dicatat — konvensi wajib no.10 CLAUDE.md.
        status: e?.status ?? "",
      };
    });

    return Response.json({ extracurricularName: ekskul.name, journalId: journal?.id ?? null, materi: journal?.materi ?? "", rows });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Anda bukan Pembina ekstrakurikuler ini." }, { status: 403 });
    return Response.json({ error: "Gagal memuat data" }, { status: 500 });
  }
}

interface RowInput { studentId: string; status: string }

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacherId = await getTeacherId(session.email);
    if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    const body = await req.json() as { extracurricularId: string; date: string; materi?: string; rows: RowInput[] };
    const { extracurricularId, materi } = body;
    const rows = body.rows ?? [];
    const date = new Date(body.date);
    const nextDay = new Date(date.getTime() + 86400000);

    const ekskul = await prisma.extracurricular.findUnique({ where: { id: extracurricularId } });
    if (!ekskul) return Response.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    if (rows.length === 0) return Response.json({ error: "Belum ada peserta di ekstrakurikuler ini" }, { status: 400 });
    const missing = rows.filter(r => !r.status);
    if (missing.length > 0) {
      return Response.json({ error: `${missing.length} peserta belum diisi statusnya — isi semua sebelum simpan.` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.extracurricularJournal.deleteMany({ where: { extracurricularId, date: { gte: date, lt: nextDay } } });
      await tx.extracurricularJournal.create({
        data: {
          extracurricularId, teacherId, date, materi: materi?.trim() || null,
          entries: { create: rows.map(r => ({ studentId: r.studentId, status: r.status })) },
        },
      });
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Anda bukan Pembina ekstrakurikuler ini." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan absen" }, { status: 500 });
  }
}
