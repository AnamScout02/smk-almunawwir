import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { bolehPasskey, pihakTerpercaya } from "@/lib/passkey";

export const dynamic = "force-dynamic";

/** Passkey milik akun yang sedang masuk (untuk kartu di halaman Profil). Kunci publik tidak dikirim ke browser. */
export async function GET(req: Request) {
  try {
    const session = await verifySession();
    const daftar = bolehPasskey(session.role) ? await prisma.passkey.findMany({
      where: { userId: session.userId }, orderBy: { createdAt: "desc" },
      select: { id: true, nama: true, rpId: true, createdAt: true, terakhirDipakai: true },
    }) : [];
    const rp = pihakTerpercaya(req.headers);
    return Response.json({ boleh: bolehPasskey(session.role), daftar, domainAman: !!rp, domain: rp?.rpID ?? null });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat passkey." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await verifySession();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const p = await prisma.passkey.findFirst({ where: { id, userId: session.userId }, select: { id: true, nama: true } });
    if (!p) return Response.json({ error: "Passkey tidak ditemukan." }, { status: 404 });
    await prisma.passkey.delete({ where: { id: p.id } });
    await logActivity(session, { action: "DELETE", entity: "Passkey", entityId: p.id, description: `Menghapus passkey "${p.nama}"` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus passkey." }, { status: 500 });
  }
}
