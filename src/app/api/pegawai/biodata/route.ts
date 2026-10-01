import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bacaBiodataPegawai } from "@/lib/biodata-pegawai";
import { STATUS_SELESAI } from "@/lib/profile-edit-fields";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
    const biodata = await bacaBiodataPegawai(session.userId);
    if (!biodata) return Response.json({ error: "Akun tidak ditemukan" }, { status: 404 });

    const [pending, history] = await Promise.all([
      prisma.pegawaiEditRequest.findMany({
        where: { userId: session.userId, status: "PENDING" },
        orderBy: { createdAt: "desc" }, take: 1,
        select: { id: true, createdAt: true },
      }),
      prisma.pegawaiEditRequest.findMany({
        where: { userId: session.userId, status: { in: STATUS_SELESAI } },
        orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true, changes: true },
      }),
    ]);

    return Response.json({ ...biodata, pending: pending[0] ?? null, history });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat biodata" }, { status: 500 });
  }
}
