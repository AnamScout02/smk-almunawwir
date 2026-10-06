import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { petugasTu } from "@/lib/tas-access-guard";
import { bolehPunyaTtd, hapusTtd, simpanTtd } from "@/lib/ttd";
import { ttdDariPermintaan } from "@/lib/ttd-masuk";

export const dynamic = "force-dynamic";

async function sasaran(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
  return u && bolehPunyaTtd(u.role) ? u : null;
}

/** TU/Admin mengunggah atau mengganti TTD pegawai lain (mis. dari scan TTD basah di atas kertas). */
export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const s = await verifySession();
    if (!(await petugasTu())) return Response.json({ error: "Khusus Tata Usaha." }, { status: 403 });
    const u = await sasaran((await params).userId);
    if (!u) return Response.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    const h = await ttdDariPermintaan(req);
    if ("galat" in h) return Response.json({ error: h.galat }, { status: 400 });
    await simpanTtd(u.id, h.png);
    await logActivity(s, { action: "UPDATE", entity: "TandaTangan", entityId: u.id, description: `Memperbarui tanda tangan ${u.name}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const s = await verifySession();
    if (!(await petugasTu())) return Response.json({ error: "Khusus Tata Usaha." }, { status: 403 });
    const u = await sasaran((await params).userId);
    if (!u) return Response.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    await hapusTtd(u.id);
    await logActivity(s, { action: "DELETE", entity: "TandaTangan", entityId: u.id, description: `Menghapus tanda tangan ${u.name}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menghapus." }, { status: 500 }); }
}
