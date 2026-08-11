import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    await verifyTasAccess();
    const { photoId } = await params;
    await prisma.majorGallery.delete({ where: { id: photoId } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus foto." }, { status: 500 });
  }
}
