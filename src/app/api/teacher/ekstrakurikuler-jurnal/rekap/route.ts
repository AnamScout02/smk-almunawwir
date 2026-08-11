import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertExtracurricularAccess } from "@/lib/ekstrakurikuler-guard";

/** Rekap kehadiran per anggota (H/I/S/A + persentase) untuk satu ekstrakurikuler — GENERIK,
 * dipakai Pramuka sekarang, otomatis berlaku utk ekskul lain juga begitu Pembina-nya mulai
 * mencatat (tidak ada logic khusus Pramuka di sini, murni parameterized by extracurricularId).
 * Filter tanggal opsional (rentang custom, mis. per bulan/semester). */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const extracurricularId = searchParams.get("extracurricularId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!extracurricularId) return Response.json({ error: "extracurricularId wajib diisi" }, { status: 400 });

    const ekskul = await prisma.extracurricular.findUnique({ where: { id: extracurricularId } });
    if (!ekskul) return Response.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    const dateFilter = from || to ? {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    } : undefined;

    const [members, entries] = await Promise.all([
      prisma.extracurricularMember.findMany({
        where: { extracurricularId },
        include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: { student: { user: { name: "asc" } } },
      }),
      prisma.extracurricularJournalEntry.findMany({
        where: { journal: { extracurricularId, ...(dateFilter ? { date: dateFilter } : {}) } },
        select: { studentId: true, status: true },
      }),
    ]);

    const summary = members.map(m => {
      const own = entries.filter(e => e.studentId === m.studentId);
      const count = (s: string) => own.filter(e => e.status === s).length;
      const hadir = count("HADIR"), izin = count("IZIN"), sakit = count("SAKIT"), alpha = count("ALPHA");
      const total = own.length;
      return {
        studentId: m.studentId, nis: m.student.nis, name: m.student.user.name, className: m.student.class?.name ?? "—",
        total, hadir, izin, sakit, alpha,
        pct: total > 0 ? Math.round((hadir / total) * 100) : 0,
      };
    });

    return Response.json({ extracurricularName: ekskul.name, students: summary });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Anda bukan Pembina ekstrakurikuler ini." }, { status: 403 });
    return Response.json({ error: "Gagal memuat rekap" }, { status: 500 });
  }
}
