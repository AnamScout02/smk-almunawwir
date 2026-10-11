import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { aksesEkstra } from "@/lib/ekstra-server";
import { hashToken, tokenBaru } from "@/lib/pkl-humas";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Buat (atau GANTI) tautan portal pembina satu ekskul. Token asli hanya dikembalikan SEKALI di sini — database menyimpan
 *  hash-nya; tautan lama langsung mati begitu yang baru dibuat (dipakai saat pembina berganti / tautan tersebar). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesEkstra(session)).kelola) return Response.json({ error: "Khusus Koordinator Ekstrakurikuler." }, { status: 403 });
  const { id } = await params;
  const e = await prisma.extracurricular.findUnique({ where: { id }, select: { name: true } });
  if (!e) return Response.json({ error: "Ekstrakurikuler tidak ditemukan." }, { status: 404 });
  const token = tokenBaru();
  await prisma.extracurricular.update({ where: { id }, data: { tokenPortalHash: hashToken(token), tokenPortalDipakai: null } });
  await logActivity(session, { action: "UPDATE", entity: "Extracurricular", entityId: id, description: `Membuat tautan pembina ${e.name}` }).catch(() => null);
  return Response.json({ url: `${ALAMAT_APLIKASI}/portal-ekstra/${token}` });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesEkstra(session)).kelola) return Response.json({ error: "Khusus Koordinator Ekstrakurikuler." }, { status: 403 });
  const { id } = await params;
  const e = await prisma.extracurricular.update({ where: { id }, data: { tokenPortalHash: null, tokenPortalDipakai: null }, select: { name: true } }).catch(() => null);
  if (!e) return Response.json({ error: "Ekstrakurikuler tidak ditemukan." }, { status: 404 });
  await logActivity(session, { action: "UPDATE", entity: "Extracurricular", entityId: id, description: `Mencabut tautan pembina ${e.name}` }).catch(() => null);
  return Response.json({ ok: true });
}
