import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { bolehPunyaTtd, hapusTtd, simpanTtd } from "@/lib/ttd";
import { ttdDariPermintaan } from "@/lib/ttd-masuk";

export const dynamic = "force-dynamic";

/** TTD milik akun yang sedang masuk (kartu "Tanda Tangan Saya" di Profil). Gambarnya lewat /api/ttd/[userId]. */
export async function GET() {
  try {
    const s = await verifySession();
    const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { ttdBerkas: true, ttdDiperbarui: true } });
    return Response.json({ boleh: bolehPunyaTtd(s.role), ada: !!u?.ttdBerkas, diperbarui: u?.ttdDiperbarui ?? null, userId: s.userId });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal." }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const s = await verifySession();
    if (!bolehPunyaTtd(s.role)) return Response.json({ error: "Tanda tangan khusus guru & staf." }, { status: 403 });
    const h = await ttdDariPermintaan(req);
    if ("galat" in h) return Response.json({ error: h.galat }, { status: 400 });
    await simpanTtd(s.userId, h.png);
    await logActivity(s, { action: "UPDATE", entity: "TandaTangan", entityId: s.userId, description: "Memperbarui tanda tangan sendiri" }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan tanda tangan." }, { status: 500 }); }
}

export async function DELETE() {
  try {
    const s = await verifySession();
    await hapusTtd(s.userId);
    await logActivity(s, { action: "DELETE", entity: "TandaTangan", entityId: s.userId, description: "Menghapus tanda tangan sendiri" }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menghapus." }, { status: 500 }); }
}
