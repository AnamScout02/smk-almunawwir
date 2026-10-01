import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const status = new URL(req.url).searchParams.get("status") ?? "PENDING";

    const daftar = await prisma.pegawaiEditRequest.findMany({
      where: { status },
      include: {
        user: {
          select: {
            name: true, email: true, role: true,
            teacher: { select: { nip: true, subject: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(daftar);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat pengajuan" }, { status: 500 });
  }
}
