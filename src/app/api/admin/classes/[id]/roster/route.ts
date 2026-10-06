import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { petaTtd } from "@/lib/ttd";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const cls = await prisma.class.findUnique({
      where: { id },
      select: {
        id: true, name: true, grade: true,
        major: { select: { name: true } },
        homeroom: { select: { userId: true, user: { select: { name: true } } } },
        students: {
          where: { studentStatus: "AKTIF" },
          select: { id: true, nis: true, nisn: true, gender: true, user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
    });
    if (!cls) return Response.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
    // TTD wali kelas untuk blok tanda tangan cetak Absensi & Jurnal Kelas (src/lib/ttd.ts).
    const ttdWali = cls.homeroom ? (await petaTtd([cls.homeroom.userId])).get(cls.homeroom.userId) ?? null : null;
    return Response.json({ ...cls, ttdWali });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat data kelas" }, { status: 500 });
  }
}
