import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const tanggalUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const isTanggal = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("judul" in b) data.judul = String(b.judul).trim();
    if (isTanggal(b.tanggalMulai)) data.tanggalMulai = tanggalUtc(b.tanggalMulai);
    if (isTanggal(b.tanggalSelesai)) data.tanggalSelesai = tanggalUtc(b.tanggalSelesai);
    if ("jenis" in b) data.jenis = b.jenis || "KEGIATAN";
    if ("keterangan" in b) data.keterangan = b.keterangan?.trim() || null;
    if ("hariEfektif" in b) data.hariEfektif = Boolean(b.hariEfektif);
    if ("tampilPublik" in b) data.tampilPublik = b.tampilPublik !== false;
    if ("academicYearId" in b) data.academicYearId = b.academicYearId || null;

    const row = await prisma.schoolEvent.update({
      where: { id }, data,
      include: { academicYear: { select: { id: true, name: true } } },
    });
    return Response.json(row);
  } catch {
    return Response.json({ error: "Gagal memperbarui agenda." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.schoolEvent.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus agenda." }, { status: 500 });
  }
}
