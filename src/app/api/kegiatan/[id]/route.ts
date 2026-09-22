import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { kegiatanMilik } from "@/lib/kegiatan-qr";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.kegiatan.delete({ where: { id } });
  return Response.json({ ok: true });
}
