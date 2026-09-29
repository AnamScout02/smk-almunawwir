import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";

    const requests = await prisma.profileEditRequest.findMany({
      where: { status },
      include: {
        student: {
          select: {
            nis: true, user: { select: { name: true } },
            class: { select: { name: true } }, major: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(requests);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat pengajuan" }, { status: 500 });
  }
}
