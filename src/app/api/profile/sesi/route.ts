import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { cabutSesi, cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { logActivity } from "@/lib/activity-log";
import { ringkasPerangkat } from "@/lib/perangkat";

export const dynamic = "force-dynamic";

/** PERANGKAT AKTIF milik akun yang sedang dibuka — semua peran. */
export async function GET() {
  const session = await verifySession();
  const rows = await prisma.userSession.findMany({
    where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true, ingatSaya: true },
  });
  return Response.json(rows.map(r => ({
    id: r.id, ...ringkasPerangkat(r.userAgent), ip: r.ip, masuk: r.createdAt, aktif: r.lastSeenAt,
    ingatSaya: r.ingatSaya, perangkatIni: r.id === session.sid,
  })));
}

/** Keluarkan satu perangkat (`{ id }`) atau semua perangkat lain (`{ semuaLain: true }`). */
export async function DELETE(req: Request) {
  const session = await verifySession();
  const { id, semuaLain } = await req.json().catch(() => ({}));

  if (semuaLain) {
    const n = await cabutSemuaSesiPengguna(session.userId, "DICABUT_PENGGUNA", session.sid);
    if (n > 0) {
      await logActivity(session, {
        action: "CABUT_SESI", entity: "User", entityId: session.userId,
        description: `${session.name} mengeluarkan akunnya dari ${n} perangkat lain`,
      });
    }
    return Response.json({ ok: true, jumlah: n });
  }

  if (typeof id !== "string" || !id) return Response.json({ error: "Perangkat tidak dipilih." }, { status: 400 });
  if (id === session.sid) return Response.json({ error: "Untuk perangkat ini, gunakan tombol Keluar." }, { status: 400 });
  const row = await prisma.userSession.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== session.userId) return Response.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  await cabutSesi({ id }, "DICABUT_PENGGUNA");
  return Response.json({ ok: true, jumlah: 1 });
}
