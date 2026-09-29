import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
} as const;

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if ("tanggal" in b) data.tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    if ("jenis" in b) data.jenis = b.jenis;
    if ("studentId" in b) data.studentId = b.studentId || null;
    if ("namaSiswa" in b) data.namaSiswa = String(b.namaSiswa).trim();
    if ("nisSiswa" in b) data.nisSiswa = b.nisSiswa?.trim() || null;
    if ("kelasSiswa" in b) data.kelasSiswa = b.kelasSiswa?.trim() || null;
    if ("keperluan" in b) data.keperluan = String(b.keperluan).trim();
    if ("tujuan" in b) data.tujuan = b.tujuan?.trim() || null;
    if ("signedBy" in b) data.signedBy = b.signedBy?.trim() || null;
    if ("catatan" in b) data.catatan = b.catatan?.trim() || null;
    const row = await prisma.suratKeterangan.update({ where: { id }, data, include });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui surat." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.suratKeterangan.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus surat." }, { status: 500 });
  }
}
