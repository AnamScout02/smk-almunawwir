import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hakPengumuman, rapikanSasaran } from "@/lib/pengumuman";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

async function ambilMilik(id: string) {
  const session = await verifySession();
  const hak = await hakPengumuman(session);
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!hak.boleh || !a || (!hak.semua && a.pembuatId !== session.userId)) return null;
  return { session, hak, a };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambilMilik(id);
  if (!m) return Response.json({ error: "Tidak berhak mengubah pengumuman ini." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.active === "boolean") data.active = b.active;
  if ("title" in b || "content" in b) {
    const title = String(b.title ?? "").trim().slice(0, 200);
    const content = String(b.content ?? "").trim().slice(0, 5000);
    if (!title || !content) return Response.json({ error: "Judul dan isi pengumuman wajib diisi." }, { status: 400 });
    const r = rapikanSasaran(b, m.hak);
    if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
    Object.assign(data, r.sasaran, {
      title, content,
      priority: b.priority === "URGENT" ? "URGENT" : "NORMAL",
      startDate: b.startDate ? new Date(b.startDate) : m.a.startDate,
      endDate: b.endDate ? new Date(b.endDate) : null,
      wajibKonfirmasi: !!b.wajibKonfirmasi,
    });
  }
  const a = await prisma.announcement.update({ where: { id }, data });
  await logActivity(m.session, { action: "UPDATE", entity: "Pengumuman", entityId: id, description: `Mengubah pengumuman "${a.title}"` }).catch(() => null);
  return Response.json(a);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambilMilik(id);
  if (!m) return Response.json({ error: "Tidak berhak menghapus pengumuman ini." }, { status: 403 });
  await prisma.announcement.delete({ where: { id } });
  await logActivity(m.session, { action: "DELETE", entity: "Pengumuman", entityId: id, description: `Menghapus pengumuman "${m.a.title}"` }).catch(() => null);
  return Response.json({ ok: true });
}
