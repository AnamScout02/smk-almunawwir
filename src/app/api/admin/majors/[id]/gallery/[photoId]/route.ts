import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { photoId } = await params;
    await prisma.majorGallery.delete({ where: { id: photoId } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus foto." }, { status: 500 });
  }
}
