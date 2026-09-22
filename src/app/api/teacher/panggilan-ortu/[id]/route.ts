import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPanggilan } from "@/lib/panggilan-akses";

export const dynamic = "force-dynamic";

const STATUS_BOLEH = ["DRAF", "TERBIT", "HADIR", "TIDAK_HADIR", "BATAL"];

/** Ubah jadwal/tempat/keperluan (selama DRAF) atau catat hasil (HADIR/TIDAK_HADIR/BATAL). Kesiswaan/BK/Admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const akses = await aksesPanggilan(session);
  if (!akses?.kelola) return Response.json({ error: "Khusus Kesiswaan/BK." }, { status: 403 });
  const { id } = await params;
  const p = await prisma.panggilanOrangTua.findUnique({ where: { id } });
  if (!p) return Response.json({ error: "Panggilan tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof b.jadwal === "string") {
    const d = new Date(b.jadwal);
    if (isNaN(d.getTime())) return Response.json({ error: "Jadwal tidak valid." }, { status: 400 });
    if (p.status !== "DRAF") return Response.json({ error: "Jadwal surat yang sudah terbit tidak bisa diubah." }, { status: 409 });
    data.jadwal = d;
  }
  if (typeof b.tempat === "string") data.tempat = b.tempat.trim().slice(0, 150) || null;
  if (typeof b.keperluan === "string") data.keperluan = b.keperluan.trim().slice(0, 200) || null;
  if (typeof b.catatan === "string") data.catatan = b.catatan.trim().slice(0, 1000) || null;
  if (typeof b.status === "string") {
    if (!STATUS_BOLEH.includes(b.status)) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
    if ((b.status === "HADIR" || b.status === "TIDAK_HADIR") && p.status !== "TERBIT") {
      return Response.json({ error: "Catat kehadiran setelah surat diterbitkan." }, { status: 409 });
    }
    data.status = b.status;
  }
  await prisma.panggilanOrangTua.update({ where: { id }, data });
  return Response.json({ ok: true });
}
