import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";

/** Cari siswa (nama/NIS) SELURUH sekolah — dipakai form "Tagihan Baru" di modul Bendahara.
 * Pola sama persis /api/admin/student-points/students-lookup, TAPI guard-nya assertBendahara
 * (bukan assertPiketOrKesiswaanBk) — jangan reuse endpoint itu, salah guard.
 * `classId` opsional (keputusan eksplisit user 2026-08-29: "kenapa tidak ada pilih kelas dulu")
 * — kalau diisi, boleh browse SELURUH siswa kelas itu tanpa ketik nama sama sekali (q kosong),
 * mempermudah kalau bendahara sudah tahu kelasnya tapi lupa ejaan nama persis. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const classId = searchParams.get("classId");
    if (q.length < 2 && !classId) return Response.json([]);

    const students = await prisma.student.findMany({
      where: {
        studentStatus: "AKTIF",
        ...(classId ? { classId } : {}),
        ...(q.length >= 2 ? { OR: [{ nis: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }] } : {}),
      },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
      take: classId ? 100 : 20, // browse 1 kelas boleh lebih banyak drpd pencarian nama bebas
    });
    return Response.json(students.map(s => ({ id: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—" })));
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
