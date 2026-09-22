import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { konteksPenerima, wherePengumumanUntuk } from "@/lib/pengumuman";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

/** Penerima menandai pengumuman sudah dibaca (hanya pengumuman yang memang ditujukan kepadanya). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const k = await konteksPenerima(session);
  const ada = await prisma.announcement.findFirst({ where: { id, ...wherePengumumanUntuk(k) }, select: { id: true } });
  if (!ada) return Response.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  await prisma.pengumumanDibaca.upsert({ where: { announcementId_userId: { announcementId: id, userId: session.userId } }, create: { announcementId: id, userId: session.userId }, update: {} });
  segarkanAntrean(session.userId);
  return Response.json({ ok: true });
}
