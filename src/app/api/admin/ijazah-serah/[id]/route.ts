import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const INCLUDE = {
  student: {
    select: {
      id: true, nis: true, nisn: true, enrollYear: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      major: { select: { code: true, name: true } },
    },
  },
};

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("studentId" in b) data.studentId = b.studentId;
    if ("dokumen" in b) data.dokumen = Array.isArray(b.dokumen) ? b.dokumen.filter(Boolean) : [];
    if ("nomorIjazah" in b) data.nomorIjazah = b.nomorIjazah?.trim() || null;
    if ("tanggalSerah" in b) data.tanggalSerah = b.tanggalSerah ? new Date(b.tanggalSerah) : new Date();
    if ("diambilOleh" in b) data.diambilOleh = b.diambilOleh || "SENDIRI";
    if ("pengambilNama" in b) data.pengambilNama = String(b.pengambilNama).trim();
    if ("pengambilHubungan" in b) data.pengambilHubungan = b.pengambilHubungan?.trim() || null;
    if ("pengambilNik" in b) data.pengambilNik = b.pengambilNik?.trim() || null;
    if ("pengambilPhone" in b) data.pengambilPhone = b.pengambilPhone?.trim() || null;
    if ("petugas" in b) data.petugas = b.petugas?.trim() || null;
    if ("keterangan" in b) data.keterangan = b.keterangan?.trim() || null;

    const row = await prisma.ijazahHandover.update({ where: { id }, data, include: INCLUDE });
    return Response.json(row);
  } catch {
    return Response.json({ error: "Gagal memperbarui data penyerahan." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.ijazahHandover.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus data penyerahan." }, { status: 500 });
  }
}
