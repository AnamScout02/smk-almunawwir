import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { hakTugas, STATUS_TUGAS } from "@/lib/tugas-internal";

export const dynamic = "force-dynamic";

/** Penerima menandai Dikerjakan/Selesai (+catatan hasil); pemberi boleh membatalkan atau mengubah. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  const hak = await hakTugas(session);
  const tugas = await prisma.tugasInternal.findUnique({ where: { id } });
  if (!tugas) return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });

  const penerima = tugas.penerimaId === session.userId || tugas.targetJabatan.some(j => hak.jabatan.includes(j));
  const pemberi = tugas.pemberiId === session.userId || hak.bolehLihatSemua;
  if (!penerima && !pemberi) return Response.json({ error: "Tidak berhak." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const status = STATUS_TUGAS.includes(b.status) ? b.status : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  if (status === "DIBATALKAN" && !pemberi) return Response.json({ error: "Hanya pemberi tugas yang bisa membatalkan." }, { status: 403 });

  const selesai = status === "SELESAI";
  await prisma.tugasInternal.update({
    where: { id },
    data: {
      status,
      catatanHasil: typeof b.catatanHasil === "string" ? b.catatanHasil.trim().slice(0, 2000) || null : tugas.catatanHasil,
      selesaiPada: selesai ? new Date() : null,
      selesaiOleh: selesai ? session.name : null,
    },
  });

  if (selesai && tugas.pemberiId !== session.userId) {
    kirimLatar(() => kirimNotifikasi({
      userIds: [tugas.pemberiId], kunci: `tugas-selesai:${tugas.id}`, jenis: "TUGAS_INTERNAL",
      judul: `Tugas selesai: ${tugas.judul}`, isi: `Diselesaikan ${session.name}`, url: "/dashboard/admin/tugas",
    }));
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  const hak = await hakTugas(session);
  const tugas = await prisma.tugasInternal.findUnique({ where: { id }, select: { pemberiId: true } });
  if (!tugas) return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  if (tugas.pemberiId !== session.userId && !hak.bolehLihatSemua) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.tugasInternal.delete({ where: { id } });
  return Response.json({ ok: true });
}
