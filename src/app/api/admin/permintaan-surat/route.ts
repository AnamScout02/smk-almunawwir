import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Antrian permintaan surat yang diajukan sendiri lewat portal siswa/orang tua.
 * `?status=DIAJUKAN` (default) — dipakai lencana jumlah di sidebar & halaman antrian. */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const status = new URL(req.url).searchParams.get("status") ?? "DIAJUKAN";
    const where = status === "SEMUA" ? { requestStatus: { not: null } } : { requestStatus: status };

    const [surat, legalisir] = await Promise.all([
      prisma.suratKeterangan.findMany({
        where,
        orderBy: { requestedAt: "asc" },
        include: {
          student: {
            select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
          },
        },
      }),
      prisma.legalisirRequest.findMany({
        where,
        orderBy: { requestedAt: "asc" },
        include: {
          student: {
            select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
          },
        },
      }),
    ]);

    // Nama pemohon ikut dikirim supaya TU tahu ini diajukan siswa sendiri atau orang tuanya.
    const pemohonIds = [...new Set([...surat, ...legalisir].map(r => r.requestedById).filter(Boolean) as string[])];
    const pemohon = pemohonIds.length
      ? await prisma.user.findMany({ where: { id: { in: pemohonIds } }, select: { id: true, name: true, role: true } })
      : [];

    return Response.json({ surat, legalisir, pemohon });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat permintaan surat" }, { status: 500 });
  }
}
