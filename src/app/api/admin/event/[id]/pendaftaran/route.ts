import { unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertEvent, STATUS_DAFTAR } from "@/lib/event-guard";
import { FOLDER_EVENT } from "@/lib/event-server";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const tolak = (e: unknown, pesan: string) => {
  lemparBilaPengalihan(e);
  if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Tidak berhak." }, { status: 403 });
  return Response.json({ error: pesan }, { status: 500 });
};

/** Daftar pendaftar satu event (siswa: kelas & NIS ikut, peserta luar: asal sekolah). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const daftar = await prisma.pendaftaranEvent.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "asc" },
      include: { student: { select: { nis: true, class: { select: { name: true } } } } },
    });
    return Response.json({
      daftar: daftar.map(({ student, karyaBerkas, buktiBayar, ...p }) => ({
        ...p, nis: student?.nis ?? null, kelas: student?.class?.name ?? null,
        adaKarya: !!karyaBerkas, adaBukti: !!buktiBayar,
      })),
    });
  } catch (e) { return tolak(e, "Gagal memuat pendaftar."); }
}

/** Ubah status / juara / catatan panitia satu pendaftar. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const p = await prisma.pendaftaranEvent.findFirst({ where: { id: String(b.pid ?? ""), eventId: id }, select: { id: true, namaPeserta: true } });
    if (!p) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    const status = STATUS_DAFTAR.includes(String(b.status)) ? String(b.status) : undefined;
    const juara = typeof b.juara === "string" ? b.juara.trim().slice(0, 60) || null : undefined;
    if (status === "JUARA" && juara === null) return Response.json({ error: "Isi peringkat juara (mis. Juara 1)." }, { status: 400 });
    await prisma.pendaftaranEvent.update({
      where: { id: p.id },
      data: {
        ...(status ? { status } : {}),
        ...(juara !== undefined ? { juara } : {}),
        ...(typeof b.catatanPanitia === "string" ? { catatanPanitia: b.catatanPanitia.trim().slice(0, 1000) || null } : {}),
      },
    });
    await logActivity(session, { action: "UPDATE", entity: "PendaftaranEvent", entityId: p.id, description: `Memperbarui pendaftaran ${p.namaPeserta}${status ? ` → ${status}` : ""}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { return tolak(e, "Gagal menyimpan."); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const pid = new URL(req.url).searchParams.get("pid") ?? "";
    const p = await prisma.pendaftaranEvent.findFirst({ where: { id: pid, eventId: id }, select: { id: true, namaPeserta: true, karyaBerkas: true, buktiBayar: true } });
    if (!p) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    await prisma.pendaftaranEvent.delete({ where: { id: p.id } });
    for (const b of [p.karyaBerkas, p.buktiBayar]) if (b) await unlink(join(FOLDER_EVENT, b.replace(/[^A-Za-z0-9.-]/g, ""))).catch(() => {});
    await logActivity(session, { action: "DELETE", entity: "PendaftaranEvent", entityId: p.id, description: `Menghapus pendaftaran ${p.namaPeserta}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { return tolak(e, "Gagal menghapus."); }
}
