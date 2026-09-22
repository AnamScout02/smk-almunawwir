import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPkl, hashToken, MASA_TAUTAN_HARI, tokenBaru } from "@/lib/pkl-humas";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Buat tautan penilaian untuk pembimbing industri (tanpa akun, berlaku 30 hari). Tautan lama otomatis tidak berlaku. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  const pkl = await aksesPkl(session, id);
  if (!pkl) return Response.json({ error: "Bukan PKL bimbingan Anda." }, { status: 403 });
  const token = tokenBaru();
  const sampai = new Date(Date.now() + MASA_TAUTAN_HARI * 86400000);
  await prisma.internship.update({ where: { id }, data: { tokenPenilaianHash: hashToken(token), tokenPenilaianSampai: sampai } });
  await logActivity(session, { action: "CREATE", entity: "TautanPenilaianPkl", entityId: id, description: `Membuat tautan penilaian industri untuk ${pkl.student.user.name}` }).catch(() => null);
  return Response.json({ url: `${ALAMAT_APLIKASI}/penilaian-pkl/${token}`, berlakuSampai: sampai });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  if (!(await aksesPkl(session, id))) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.internship.update({ where: { id }, data: { tokenPenilaianHash: null, tokenPenilaianSampai: null } });
  return Response.json({ ok: true });
}
