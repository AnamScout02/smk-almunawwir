import { unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertEvent } from "@/lib/event-guard";
import { susunEvent, FOLDER_EVENT } from "@/lib/event-server";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const tolak = (e: unknown, pesan: string) => {
  lemparBilaPengalihan(e);
  if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Humas, Publikasi, Kesiswaan, dan Pembina OSIS." }, { status: 403 });
  return Response.json({ error: pesan }, { status: 500 });
};

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const ada = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!ada) return Response.json({ error: "Event tidak ditemukan." }, { status: 404 });
    const hasil = await susunEvent(await req.json().catch(() => ({})), id);
    if ("galat" in hasil) return Response.json({ error: hasil.galat }, { status: 400 });
    const e = await prisma.event.update({ where: { id }, data: hasil.data, select: { id: true, slug: true } });
    await logActivity(session, { action: "UPDATE", entity: "Event", entityId: id, description: `Mengubah event ${hasil.data.judul}` }).catch(() => {});
    return Response.json(e);
  } catch (e) { return tolak(e, "Gagal menyimpan event."); }
}

/** Hapus event BESERTA pendaftarnya. Berkas karya & bukti bayar ikut dihapus dari folder rahasia —
 *  tanpa itu berkas pribadi tertinggal tanpa pemilik dan tidak bisa dibuka lewat layar mana pun. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const e = await prisma.event.findUnique({
      where: { id },
      select: { judul: true, pendaftaran: { select: { karyaBerkas: true, buktiBayar: true } } },
    });
    if (!e) return Response.json({ error: "Event tidak ditemukan." }, { status: 404 });
    await prisma.event.delete({ where: { id } });
    const berkas = e.pendaftaran.flatMap(p => [p.karyaBerkas, p.buktiBayar]).filter((x): x is string => !!x);
    await Promise.all(berkas.map(b => unlink(join(FOLDER_EVENT, b.replace(/[^A-Za-z0-9.-]/g, ""))).catch(() => {})));
    await logActivity(session, { action: "DELETE", entity: "Event", entityId: id, description: `Menghapus event ${e.judul} (${e.pendaftaran.length} pendaftar)` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { return tolak(e, "Gagal menghapus event."); }
}
