import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertExtracurricularAccess } from "@/lib/ekstrakurikuler-guard";

/** Riwayat pertemuan Absen Ekstra — daftar sesi yang sudah pernah dicatat utk satu
 * ekstrakurikuler, dipakai buat tabel "Riwayat Pertemuan" + lompat-edit (klik = isi ulang
 * tanggal itu di form). Sama pola dgn /api/teacher/journal/history (Jurnal Mengajar). */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const extracurricularId = searchParams.get("extracurricularId");
    if (!extracurricularId) return Response.json({ error: "extracurricularId wajib diisi" }, { status: 400 });

    const ekskul = await prisma.extracurricular.findUnique({ where: { id: extracurricularId } });
    if (!ekskul) return Response.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    const journals = await prisma.extracurricularJournal.findMany({
      where: { extracurricularId },
      include: { entries: { select: { status: true } } },
      orderBy: { date: "desc" },
      take: 100,
    });

    const result = journals.map(j => {
      const count = (status: string) => j.entries.filter(e => e.status === status).length;
      return {
        id: j.id,
        date: j.date,
        materi: j.materi,
        totalPeserta: j.entries.length,
        hadir: count("HADIR"), izin: count("IZIN"), sakit: count("SAKIT"), alpha: count("ALPHA"),
      };
    });

    return Response.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Anda bukan Pembina ekstrakurikuler ini." }, { status: 403 });
    return Response.json({ error: "Gagal memuat riwayat" }, { status: 500 });
  }
}
