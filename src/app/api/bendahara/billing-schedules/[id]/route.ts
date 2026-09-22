import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    const { name, notes, active } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Nama wajib diisi" }, { status: 400 });

    // SENGAJA cuma nama/catatan/aktif yang bisa diubah — field yg memengaruhi progress
    // (feeTypeId/classId/periodType/startDate/frequency/dueDateOffsetDays) tidak diedit setelah
    // dibuat, supaya generatedCount/lastGeneratedAt yg sudah jalan tidak jadi rancu artinya.
    // Kalau perlu ubah itu semua, hapus jadwal lalu buat baru.
    const schedule = await prisma.billingSchedule.update({
      where: { id },
      data: { name: name.trim(), notes: notes || null, active: active ?? true },
      include: { feeType: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
    });
    return Response.json(schedule);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal mengubah jadwal tagihan" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { id } = await params;
    // Hapus jadwal itu sendiri saja — Invoice yang SUDAH ke-generate dari jadwal ini sebelumnya
    // TIDAK ikut terhapus (independen, tidak ada relasi FK ke BillingSchedule di model Invoice).
    await prisma.billingSchedule.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus jadwal tagihan" }, { status: 500 });
  }
}
