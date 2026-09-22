import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { pakaiSecure } from "@/lib/session";
import { KUNCI_SESI_TUNGGAL, cabutSesi, cabutSemuaSesiPengguna, peranSesiTunggal } from "@/lib/sesi-server";
import { logActivity } from "@/lib/activity-log";
import { ringkasPerangkat } from "@/lib/perangkat";

export const dynamic = "force-dynamic";

const PERAN = ["ADMIN", "TAS", "TEACHER", "STUDENT", "PARENT"] as const;
const HARI_MS = 24 * 60 * 60 * 1000;

/** KEAMANAN & SESI LOGIN — khusus ADMIN. Sesi aktif seluruh pengguna + kebijakan satu perangkat. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const now = new Date();

  // Bersih-bersih: baris yang sudah mati lebih dari 30 hari tidak ada gunanya lagi.
  await prisma.userSession.deleteMany({
    where: { OR: [{ revokedAt: { lt: new Date(now.getTime() - 30 * HARI_MS) } }, { expiresAt: { lt: new Date(now.getTime() - 30 * HARI_MS) } }] },
  }).catch(() => {});

  const [rows, sesiTunggal, dicabut24j] = await Promise.all([
    prisma.userSession.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: "desc" },
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    peranSesiTunggal(),
    prisma.userSession.count({ where: { revokedAt: { gte: new Date(now.getTime() - HARI_MS) } } }),
  ]);

  const targetIds = [...new Set(rows.map(r => r.impersonatingUserId).filter((x): x is string => !!x))];
  const targets = targetIds.length
    ? await prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true } })
    : [];
  const namaTarget = new Map(targets.map(t => [t.id, t.name]));

  return Response.json({
    https: pakaiSecure(req.headers),
    sesiTunggal,
    dicabut24j,
    sesi: rows.map(r => ({
      id: r.id, userId: r.userId, nama: r.user.name, email: r.user.email, peran: r.user.role,
      ...ringkasPerangkat(r.userAgent), ip: r.ip, masuk: r.createdAt, aktif: r.lastSeenAt,
      ingatSaya: r.ingatSaya, perangkatIni: r.id === session.sid,
      masukSebagai: r.impersonatingUserId ? namaTarget.get(r.impersonatingUserId) ?? "(akun terhapus)" : null,
    })),
  });
}

/** Simpan kebijakan: peran mana yang hanya boleh aktif di SATU perangkat. */
export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const { sesiTunggal } = await req.json().catch(() => ({}));
  if (!Array.isArray(sesiTunggal)) return Response.json({ error: "Data tidak valid." }, { status: 400 });
  const bersih = PERAN.filter(p => sesiTunggal.includes(p));
  await prisma.siteSetting.upsert({
    where: { key: KUNCI_SESI_TUNGGAL },
    update: { value: JSON.stringify(bersih) },
    create: { key: KUNCI_SESI_TUNGGAL, value: JSON.stringify(bersih) },
  });
  await logActivity(session, {
    action: "UBAH_KEBIJAKAN_SESI", entity: "SiteSetting", entityId: KUNCI_SESI_TUNGGAL,
    description: `${session.name} mengatur satu-akun-satu-perangkat untuk: ${bersih.length ? bersih.join(", ") : "tidak ada"}`,
  });
  return Response.json({ ok: true, sesiTunggal: bersih });
}

/** Cabut satu sesi (`{ id }`) atau semua sesi seorang pengguna (`{ userId }`). */
export async function DELETE(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const { id, userId } = await req.json().catch(() => ({}));

  if (typeof userId === "string" && userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (!u) return Response.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    // Jangan ikut mengeluarkan admin dari perangkat yang sedang dipakainya sendiri.
    const n = await cabutSemuaSesiPengguna(userId, "DICABUT_ADMIN", userId === session.userId ? session.sid : null);
    await logActivity(session, {
      action: "CABUT_SESI", entity: "User", entityId: userId,
      description: `${session.name} mencabut ${n} sesi login milik ${u.name}`,
    });
    return Response.json({ ok: true, jumlah: n });
  }

  if (typeof id !== "string" || !id) return Response.json({ error: "Sesi tidak dipilih." }, { status: 400 });
  if (id === session.sid) return Response.json({ error: "Ini sesi Anda sendiri — gunakan tombol Keluar." }, { status: 400 });
  const row = await prisma.userSession.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!row) return Response.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  await cabutSesi({ id }, "DICABUT_ADMIN");
  await logActivity(session, {
    action: "CABUT_SESI", entity: "User", entityId: row.userId,
    description: `${session.name} mencabut satu sesi login milik ${row.user.name}`,
  });
  return Response.json({ ok: true, jumlah: 1 });
}
