import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id: userId } = await params;
    const { jabatanIds } = await req.json();
    if (!Array.isArray(jabatanIds)) {
      return Response.json({ error: "Data jabatan tidak valid." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.staffJabatan.deleteMany({ where: { userId } });
      if (jabatanIds.length > 0) {
        await tx.staffJabatan.createMany({
          data: jabatanIds.map((jabatanId: string) => ({ userId, jabatanId })),
        });
      }
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menyimpan jabatan." }, { status: 500 });
  }
}
