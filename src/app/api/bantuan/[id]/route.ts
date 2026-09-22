import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { petugasTu } from "@/lib/tas-access-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { BARU: "menunggu", DIPROSES: "sedang ditangani", SELESAI: "selesai" };

/** Petugas TU/Admin menanggapi tiket; pengirim boleh menutup/menghapus tiketnya sendiri yang masih BARU. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!(await petugasTu())) return Response.json({ error: "Khusus staf TU & Admin." }, { status: 403 });
  const { id } = await params;
  const t = await prisma.tiketBantuan.findUnique({ where: { id } });
  if (!t) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const status = STATUS[String(b.status ?? "")] ? String(b.status) : t.status;
  const tanggapan = String(b.tanggapan ?? "").trim().slice(0, 2000) || null;
  await prisma.tiketBantuan.update({ where: { id }, data: { status, tanggapan, penanganNama: session.name, selesaiPada: status === "SELESAI" ? new Date() : null } });
  if (t.pengirimId && (status !== t.status || tanggapan !== t.tanggapan)) {
    kirimLatar(() => kirimNotifikasi({
      userIds: [t.pengirimId!], jenis: "PENGUMUMAN", kunci: `bantuan-balas:${id}:${status}:${(tanggapan ?? "").length}`,
      judul: `Bantuan Anda ${STATUS[status]}`, isi: tanggapan ?? "Dibalas oleh petugas.", url: "/bantuan", tag: `bantuan-${id}`,
    }));
  }
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const t = await prisma.tiketBantuan.findUnique({ where: { id } });
  if (!t) return Response.json({ ok: true });
  const petugas = await petugasTu();
  if (!petugas && !(t.pengirimId === session.userId && t.status === "BARU")) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.tiketBantuan.delete({ where: { id } });
  return Response.json({ ok: true });
}
