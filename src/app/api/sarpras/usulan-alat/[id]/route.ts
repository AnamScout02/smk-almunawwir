import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DIUSULKAN: "dikembalikan ke usulan", DISETUJUI: "disetujui", DIBELI: "sudah diadakan", DITOLAK: "belum bisa diadakan" };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const { id } = await params;
  const u = await prisma.usulanAlat.findUnique({ where: { id } });
  if (!u) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  if (!(a.penuh || (a.lab && u.lingkup === "LAB"))) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const status = STATUS[String(b.status ?? "")] ? String(b.status) : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  const tanggapan = String(b.tanggapan ?? "").trim().slice(0, 500) || null;
  await prisma.usulanAlat.update({ where: { id }, data: { status, tanggapan } });
  if (status !== u.status) {
    kirimLatar(() => kirimNotifikasi({
      userIds: [u.pengusulId], jenis: "SARPRAS", kunci: `usulan-alat-status:${id}:${status}`,
      judul: `Usulan "${u.nama}" ${STATUS[status]}`, isi: tanggapan ?? "", url: "/dashboard/teacher/usulan-alat", tag: `usulan-alat-${id}`,
    }));
  }
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const { id } = await params;
  const u = await prisma.usulanAlat.findUnique({ where: { id } });
  if (!u) return Response.json({ ok: true });
  if (!a.penuh && !(u.pengusulId === session.userId && u.status === "DIUSULKAN")) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.usulanAlat.delete({ where: { id } });
  return Response.json({ ok: true });
}
