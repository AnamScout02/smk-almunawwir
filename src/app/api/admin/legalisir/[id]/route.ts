import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** Sama seperti buku-tamu/[id]: PUT dipakai untuk edit penuh MAUPUN tombol cepat ubah status
 * ("Tandai Selesai"/"Tandai Diambil" cuma kirim { status, pickupDate }) — makanya tiap field
 * di-update hanya kalau key-nya ada di body. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("requestDate" in b) data.requestDate = b.requestDate ? new Date(b.requestDate) : new Date();
    if ("studentId" in b) data.studentId = b.studentId || null;
    if ("applicantName" in b) data.applicantName = String(b.applicantName).trim();
    if ("documentType" in b) data.documentType = b.documentType || "IJAZAH";
    if ("documentNo" in b) data.documentNo = b.documentNo?.trim() || null;
    if ("copies" in b) data.copies = Number(b.copies) > 0 ? Number(b.copies) : 1;
    if ("purpose" in b) data.purpose = String(b.purpose).trim();
    if ("signedBy" in b) data.signedBy = b.signedBy?.trim() || null;
    if ("status" in b) data.status = b.status;
    if ("pickupDate" in b) data.pickupDate = b.pickupDate ? new Date(b.pickupDate) : null;
    if ("notes" in b) data.notes = b.notes?.trim() || null;

    const row = await prisma.legalisirRequest.update({
      where: { id }, data,
      include: {
        student: {
          select: {
            id: true, nis: true, enrollYear: true, studentStatus: true,
            user: { select: { name: true } }, major: { select: { code: true } },
          },
        },
      },
    });
    return Response.json(row);
  } catch {
    return Response.json({ error: "Gagal memperbarui permintaan legalisir." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.legalisirRequest.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus permintaan legalisir." }, { status: 500 });
  }
}
