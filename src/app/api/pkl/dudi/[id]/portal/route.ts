import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";
import { hashToken, tokenBaru } from "@/lib/pkl-humas";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export const dynamic = "force-dynamic";

/** Membuat (atau MENGGANTI) tautan portal industri satu DUDI. Token asli hanya ditampilkan SEKALI di sini —
 *  database menyimpan hash-nya saja; tautan lama langsung mati begitu yang baru dibuat. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const d = await prisma.industryPartner.findUnique({ where: { id }, select: { name: true } });
    if (!d) return Response.json({ error: "DUDI tidak ditemukan." }, { status: 404 });
    const token = tokenBaru();
    await prisma.industryPartner.update({ where: { id }, data: { tokenPortalHash: hashToken(token) } });
    await logActivity(session, { action: "UPDATE", entity: "IndustryPartner", entityId: id, description: `Membuat tautan portal industri ${d.name}` }).catch(() => null);
    return Response.json({ url: `${ALAMAT_APLIKASI}/portal-dudi/${token}` });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const d = await prisma.industryPartner.update({ where: { id }, data: { tokenPortalHash: null }, select: { name: true } });
    await logActivity(session, { action: "UPDATE", entity: "IndustryPartner", entityId: id, description: `Mencabut tautan portal industri ${d.name}` }).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
