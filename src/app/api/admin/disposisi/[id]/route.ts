import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Setiap field hanya diubah kalau key-nya ADA di body — supaya tombol cepat "Tandai Selesai"
 * (yang cuma mengirim { status }) tidak ikut mengosongkan instruksi/tujuan. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("tanggal" in b) data.tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    if ("tujuan" in b) data.tujuan = Array.isArray(b.tujuan) ? b.tujuan.map((t: string) => String(t).trim()).filter(Boolean) : [];
    if ("instruksi" in b) data.instruksi = String(b.instruksi).trim();
    if ("sifat" in b) data.sifat = b.sifat || "BIASA";
    if ("batasWaktu" in b) data.batasWaktu = b.batasWaktu ? new Date(b.batasWaktu) : null;
    if ("tindakLanjut" in b) data.tindakLanjut = b.tindakLanjut?.trim() || null;
    if ("dariNama" in b) data.dariNama = b.dariNama?.trim() || null;
    if ("status" in b) {
      data.status = b.status || "BARU";
      // Tanggal selesai diisi/dikosongkan mengikuti statusnya, bukan diinput terpisah —
      // supaya tidak pernah ada baris "SELESAI" tanpa tanggal (atau sebaliknya).
      data.selesaiAt = b.status === "SELESAI" ? new Date() : null;
    }

    const row = await prisma.disposisi.update({
      where: { id }, data,
      include: { surat: { select: { id: true, nomor: true, tanggal: true, pihak: true, perihal: true, fileUrl: true } } },
    });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui disposisi." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.disposisi.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus disposisi." }, { status: 500 });
  }
}
