import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** PUT dipakai untuk 2 hal: koreksi isian (edit penuh) DAN tombol cepat "Tandai Pulang"
 * (cuma kirim { timeOut }). Karena itu setiap field di-update hanya kalau key-nya ADA di body —
 * jangan diubah jadi `b.field ?? null`, itu bakal mengosongkan field lain saat tandai-pulang. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("visitDate" in b) data.visitDate = b.visitDate ? new Date(b.visitDate) : new Date();
    if ("timeIn" in b) data.timeIn = b.timeIn || null;
    if ("timeOut" in b) data.timeOut = b.timeOut || null;
    if ("guestName" in b) data.guestName = String(b.guestName).trim();
    if ("category" in b) data.category = b.category || "UMUM";
    if ("institution" in b) data.institution = b.institution?.trim() || null;
    if ("studentId" in b) data.studentId = b.studentId || null;
    if ("purpose" in b) data.purpose = String(b.purpose).trim();
    if ("metWith" in b) data.metWith = b.metWith?.trim() || null;
    if ("phone" in b) data.phone = b.phone?.trim() || null;
    if ("notes" in b) data.notes = b.notes?.trim() || null;
    // Foto dokumentasi kunjungan — hanya lewat jalur admin ini; formulir tamu publik tidak
    // pernah mengirimkannya (lihat /api/public/buku-tamu).
    if ("photoUrl" in b) data.photoUrl = b.photoUrl || null;

    const entry = await prisma.guestBookEntry.update({
      where: { id }, data,
      include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    });
    return Response.json(entry);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui data kunjungan." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.guestBookEntry.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus data kunjungan." }, { status: 500 });
  }
}
