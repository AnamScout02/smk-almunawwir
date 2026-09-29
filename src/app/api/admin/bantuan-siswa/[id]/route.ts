import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { code: true } } } },
} as const;

/** PUT melayani edit penuh MAUPUN tombol cepat "Tandai Sudah Diambil" (cuma kirim statusAmbil +
 * tanggalAmbil) — tiap field hanya di-update kalau key-nya ada di body. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if ("studentId" in b) data.studentId = b.studentId;
    if ("jenis" in b) data.jenis = b.jenis;
    if ("tahun" in b) data.tahun = Number(b.tahun) || new Date().getFullYear();
    if ("tahap" in b) data.tahap = b.tahap?.trim() || null;
    if ("nominal" in b) data.nominal = Number(b.nominal) || 0;
    if ("noSk" in b) data.noSk = b.noSk?.trim() || null;
    if ("tanggalCair" in b) data.tanggalCair = b.tanggalCair ? new Date(b.tanggalCair) : null;
    if ("bank" in b) data.bank = b.bank?.trim() || null;
    if ("noRekening" in b) data.noRekening = b.noRekening?.trim() || null;
    if ("statusAmbil" in b) data.statusAmbil = b.statusAmbil;
    if ("tanggalAmbil" in b) data.tanggalAmbil = b.tanggalAmbil ? new Date(b.tanggalAmbil) : null;
    if ("diambilOleh" in b) data.diambilOleh = b.diambilOleh?.trim() || null;
    if ("catatan" in b) data.catatan = b.catatan?.trim() || null;
    const row = await prisma.bantuanSiswa.update({ where: { id }, data, include });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui data bantuan." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.bantuanSiswa.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus data bantuan." }, { status: 500 });
  }
}
