import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Field hanya diubah kalau key-nya ADA di body — tombol cepat "Tandai Diterima" cuma
 * mengirim { penerimaNama, tanggalTerima, status }. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("tanggal" in b) data.tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    if ("suratId" in b) data.suratId = b.suratId || null;
    if ("nomorSurat" in b) data.nomorSurat = b.nomorSurat?.trim() || null;
    if ("perihal" in b) data.perihal = String(b.perihal).trim();
    if ("tujuan" in b) data.tujuan = String(b.tujuan).trim();
    if ("alamatTujuan" in b) data.alamatTujuan = b.alamatTujuan?.trim() || null;
    if ("jumlah" in b) data.jumlah = Number(b.jumlah) > 0 ? Number(b.jumlah) : 1;
    if ("caraKirim" in b) data.caraKirim = b.caraKirim || "LANGSUNG";
    if ("penerimaNama" in b) data.penerimaNama = b.penerimaNama?.trim() || null;
    if ("penerimaJabatan" in b) data.penerimaJabatan = b.penerimaJabatan?.trim() || null;
    if ("petugas" in b) data.petugas = b.petugas?.trim() || null;
    if ("keterangan" in b) data.keterangan = b.keterangan?.trim() || null;
    if ("status" in b) {
      data.status = b.status || "DIKIRIM";
      data.tanggalTerima = b.status === "DITERIMA" ? (b.tanggalTerima ? new Date(b.tanggalTerima) : new Date()) : null;
    }

    const row = await prisma.ekspedisi.update({
      where: { id }, data,
      include: { surat: { select: { id: true, nomor: true, perihal: true } } },
    });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui catatan ekspedisi." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.ekspedisi.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus catatan ekspedisi." }, { status: 500 });
  }
}
