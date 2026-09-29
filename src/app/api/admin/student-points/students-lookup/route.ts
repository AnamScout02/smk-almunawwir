import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPiketOrKesiswaanBk } from "@/lib/kesiswaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Cari siswa (nama/NIS) SELURUH sekolah — dipakai form input poin Guru Piket & BK/Kesiswaan,
 * yg keduanya butuh cari siswa lintas kelas (piket jaga gerbang sekolah, bukan cuma kelas
 * walinya). Beda dari /api/teacher/students yg scoped ke kelas wali/ajar guru itu sendiri. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPiketOrKesiswaanBk(session);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) return Response.json([]);

    const students = await prisma.student.findMany({
      where: {
        studentStatus: "AKTIF",
        OR: [{ nis: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }],
      },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
      take: 20,
    });
    return Response.json(students.map(s => ({ id: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—" })));
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Bukan piket hari ini/BK/Wakasek Kesiswaan." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
