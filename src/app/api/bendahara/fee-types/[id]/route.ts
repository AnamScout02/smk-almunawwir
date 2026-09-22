import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    const { name, defaultAmount, active } = await req.json();
    if (!name?.trim() || typeof defaultAmount !== "number" || defaultAmount < 0) {
      return Response.json({ error: "Nama dan jumlah default wajib diisi dengan benar" }, { status: 400 });
    }
    const type = await prisma.feeType.update({
      where: { id },
      data: { name: name.trim(), defaultAmount, active: active ?? true },
    });
    return Response.json(type);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal mengubah jenis biaya" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    const used = await prisma.invoice.count({ where: { feeTypeId: id } });
    if (used > 0) {
      // Sudah pernah dipakai bikin tagihan — nonaktifkan saja, jangan hapus (tagihan lama tetap valid).
      const type = await prisma.feeType.update({ where: { id }, data: { active: false } });
      return Response.json({ deactivated: true, type });
    }
    await prisma.feeType.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus jenis biaya" }, { status: 500 });
  }
}
