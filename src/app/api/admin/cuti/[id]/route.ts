import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const include = {
  teacher: { select: { id: true, nip: true, position: true, user: { select: { name: true } } } },
} as const;

/** PUT dipakai untuk edit penuh MAUPUN tombol cepat Setujui/Tolak (cuma kirim { status }) —
 * makanya tiap field hanya di-update kalau key-nya ada di body. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if ("teacherId" in b) data.teacherId = b.teacherId;
    if ("jenis" in b) data.jenis = b.jenis;
    if ("startDate" in b) data.startDate = new Date(b.startDate);
    if ("endDate" in b) data.endDate = new Date(b.endDate);
    if ("days" in b) data.days = Number(b.days) > 0 ? Number(b.days) : 1;
    if ("reason" in b) data.reason = String(b.reason).trim();
    if ("attachmentUrl" in b) data.attachmentUrl = b.attachmentUrl || null;
    if ("notes" in b) data.notes = b.notes?.trim() || null;
    if ("approvedBy" in b) data.approvedBy = b.approvedBy?.trim() || null;
    if ("status" in b) {
      data.status = b.status;
      // Jejak persetujuan diisi otomatis saat status berubah — jangan dibiarkan bergantung pada
      // form, supaya tombol cepat "Setujui" pun tetap tercatat siapa & kapan menyetujui.
      data.approvedAt = b.status === "DISETUJUI" ? new Date() : null;
      if (b.status === "DISETUJUI" && !b.approvedBy) data.approvedBy = session.name;
    }
    const row = await prisma.staffLeave.update({ where: { id }, data, include });
    // Cuti/surat tugas ↔ Presensi Pegawai (src/lib/presensi-turunan.ts) — di latar, gagal di sini tidak menggagalkan simpan.
    void import("@/lib/presensi-turunan").then(m => m.sinkronPresensiDokumenBaku()).catch(() => null);
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui data cuti." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.staffLeave.delete({ where: { id } });
    // Cuti/surat tugas ↔ Presensi Pegawai (src/lib/presensi-turunan.ts) — di latar, gagal di sini tidak menggagalkan simpan.
    void import("@/lib/presensi-turunan").then(m => m.sinkronPresensiDokumenBaku()).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus data cuti." }, { status: 500 });
  }
}
