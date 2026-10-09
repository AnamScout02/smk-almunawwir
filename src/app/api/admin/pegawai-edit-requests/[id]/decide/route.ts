import { potretGuru, catatRiwayatGuru } from "@/lib/riwayat-induk";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { terapkanBiodataPegawai } from "@/lib/biodata-pegawai";
import { statusKeputusan } from "@/lib/profile-edit-fields";
import { logActivity } from "@/lib/activity-log";
import type { ChangeEntry } from "@/lib/profile-edit-fields";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    /** `tolak` = kunci isian yang DITOLAK; sisanya tetap diterapkan (30 Sep 2026) — satu
     *  pengajuan sering memuat satu isian salah tulis, dan menolak seluruhnya memaksa pegawai
     *  mengulang semuanya. */
    const body = await req.json() as { action: "APPROVE" | "REJECT"; note?: string; tolak?: string[] };

    const pengajuan = await prisma.pegawaiEditRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, changes: true, user: { select: { name: true } } },
    });
    if (!pengajuan) return Response.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (pengajuan.status !== "PENDING") return Response.json({ error: "Pengajuan ini sudah diproses" }, { status: 409 });

    if (body.action === "REJECT") {
      await prisma.pegawaiEditRequest.update({
        where: { id },
        data: { status: "REJECTED", reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name },
      });
      await logActivity(session, {
        action: "UPDATE", entity: "PegawaiEditRequest", entityId: id,
        description: `Menolak pengajuan biodata ${pengajuan.user.name}`,
      }).catch(() => {});
      return Response.json({ success: true });
    }

    const changes = pengajuan.changes as unknown as Record<string, ChangeEntry>;
    const tolak = new Set((body.tolak ?? []).filter(k => k in changes));
    const diterima = Object.keys(changes).filter(k => !tolak.has(k));
    const changesTercatat = Object.fromEntries(
      Object.entries(changes).map(([k, v]) => [k, tolak.has(k) ? { ...v, ditolak: true } : v]),
    ) as object;

    if (diterima.length === 0) {
      await prisma.pegawaiEditRequest.update({
        where: { id },
        data: {
          status: "REJECTED", reviewNote: body.note || null, reviewedAt: new Date(),
          reviewedBy: session.name, changes: changesTercatat,
        },
      });
      await logActivity(session, {
        action: "UPDATE", entity: "PegawaiEditRequest", entityId: id,
        description: `Menolak semua perubahan biodata ${pengajuan.user.name}`,
      }).catch(() => {});
      return Response.json({ success: true, diterima: 0, ditolak: tolak.size });
    }

    const top: Record<string, unknown> = {};
    const buku: Record<string, unknown> = {};
    for (const kunci of diterima) {
      const isi = changes[kunci];
      const pisah = kunci.indexOf(":");
      const lingkup = kunci.slice(0, pisah);
      const field = kunci.slice(pisah + 1);
      if (lingkup === "top") top[field] = isi.new;
      else if (lingkup === "buku") buku[field] = isi.new;
    }

    // Riwayat Buku Induk Guru — hanya pegawai yang punya baris Teacher (staf TAS memakai BiodataPegawai, CLAUDE.md #93).
    const guruRiwayat = await prisma.teacher.findUnique({ where: { userId: pengajuan.userId }, select: { id: true } });
    const sebelumRiwayat = guruRiwayat ? await potretGuru(guruRiwayat.id) : null;
    await terapkanBiodataPegawai(pengajuan.userId, top, buku);
    if (guruRiwayat) await catatRiwayatGuru(session, guruRiwayat.id, sebelumRiwayat, "persetujuan pengajuan biodata pegawai").catch(() => 0);
    await prisma.pegawaiEditRequest.update({
      where: { id },
      data: {
        status: statusKeputusan(diterima.length, tolak.size),
        reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name,
        changes: changesTercatat,
      },
    });
    await logActivity(session, {
      action: "UPDATE", entity: "PegawaiEditRequest", entityId: id,
      description: `Biodata ${pengajuan.user.name}: ${diterima.length} isian disetujui${tolak.size ? `, ${tolak.size} ditolak` : ""}`,
    }).catch(() => {});

    return Response.json({ success: true, diterima: diterima.length, ditolak: tolak.size });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[pegawai-edit-requests decide]", e);
    return Response.json({ error: "Gagal memproses pengajuan" }, { status: 500 });
  }
}
