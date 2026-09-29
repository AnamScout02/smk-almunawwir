import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { kunciPublikVapid, pushTersedia } from "@/lib/push-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Langganan notifikasi push perangkat ini (semua peran yang login). Lihat src/lib/push-server.ts. */
export async function GET() {
  try {
    const session = await verifySession();
    const perangkat = await prisma.pushSubscription.count({ where: { userId: session.userId } });
    return Response.json({ publicKey: kunciPublikVapid(), tersedia: pushTersedia(), perangkat });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

type BodyLangganan = { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { subscription } = (await req.json().catch(() => ({}))) as BodyLangganan;
  const endpoint = subscription?.endpoint ?? "";
  const p256dh = subscription?.keys?.p256dh ?? "";
  const auth = subscription?.keys?.auth ?? "";
  if (!/^https:\/\/.{10,}/.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return Response.json({ error: "Data langganan tidak valid." }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  // Endpoint milik browser, bukan akun: kalau perangkat yang sama dipakai akun lain, langganan pindah ke akun
  // yang terakhir mengaktifkan (tidak pernah dikirimi notifikasi dua akun sekaligus).
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.userId, p256dh, auth, userAgent, lastUsedAt: new Date() },
    create: { userId: session.userId, endpoint, p256dh, auth, userAgent },
  });
  return Response.json({ ok: true });
}

/** Lepas langganan perangkat ini. Tidak butuh sesi: endpoint hanya diketahui browser pemiliknya, dan halaman
 * login memanggil ini setelah pengguna menekan Keluar (supaya perangkat bersama tidak terus menerima
 * notifikasi akun sebelumnya). */
export async function DELETE(req: NextRequest) {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint || endpoint.length > 1000) return Response.json({ error: "Endpoint kosong." }, { status: 400 });
  const r = await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return Response.json({ ok: true, dihapus: r.count });
}
