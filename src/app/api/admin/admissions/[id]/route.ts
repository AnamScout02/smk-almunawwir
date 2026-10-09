import { prisma } from "@/lib/prisma";
import { hapusTtdPakta } from "@/lib/spmb-dokumen";
import { verifySpmbAccess, STATUS_SPMB } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySpmbAccess();
    const { id } = await params;
    const body = await req.json();
    // Status hanya dari daftar resmi; skor & pembayaran TIDAK lagi lewat sini — skor satu pintu di Seleksi & Nilai,
    // pembayaran bercicil di Tahapan Calon (6 Okt 2026, data dobel yang saling menimpa).
    if (body.status !== undefined && !(STATUS_SPMB as readonly string[]).includes(body.status)) {
      return Response.json({ error: "Status tidak dikenal" }, { status: 400 });
    }
    const before = await prisma.admission.findUnique({ where: { id }, select: { status: true, fullName: true } });
    const item = await prisma.admission.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.jalur !== undefined ? { jalur: body.jalur } : {}),
      },
    });

    if (body.status !== undefined && before && before.status !== body.status) {
      await logActivity(session, {
        action: "DECIDE_ADMISSION", entity: "Admission", entityId: id,
        description: `${session.name} mengubah status pendaftar "${before.fullName}" dari ${before.status} menjadi ${body.status}`,
        metadata: { before: before.status, after: body.status },
      });
    }

    return Response.json(item);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal mengupdate" }, { status: 500 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySpmbAccess();
    const { id } = await params;
    const admission = await prisma.admission.delete({ where: { id } });
    // TTD pakta orang tua ada di folder rahasia — ikut dibuang bersama datanya.
    await hapusTtdPakta(admission.paktaTtd);
    await logActivity(session, {
      action: "DELETE_ADMISSION", entity: "Admission", entityId: id,
      description: `${session.name} menghapus data pendaftar "${admission.fullName}"`,
    });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menghapus" }, { status: 500 }); }
}
