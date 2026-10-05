import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b?.nama === "string" && b.nama.trim()) data.nama = b.nama.trim();
    if (typeof b?.buka === "string" && b.buka) {
      const d = new Date(b.buka + "T00:00:00+07:00");
      if (!isNaN(d.getTime())) data.buka = d;
    }
    if (typeof b?.tutup === "string" && b.tutup) {
      const d = new Date(b.tutup + "T23:59:59+07:00");
      if (!isNaN(d.getTime())) data.tutup = d;
    }
    if (b?.biayaDaftar !== undefined) data.biayaDaftar = Math.max(0, Number(b.biayaDaftar) || 0);
    if (b?.catatan !== undefined) data.catatan = String(b.catatan ?? "").trim() || null;
    if (b?.tahunAjaranId !== undefined) data.tahunAjaranId = String(b.tahunAjaranId ?? "").trim() || null;
    if (typeof b?.aktif === "boolean") data.aktif = b.aktif;
    if (typeof b?.urutan === "number") data.urutan = Math.max(1, Math.round(b.urutan));

    // Kuota per jurusan dikirim sekaligus: { kuota: { "<majorId>": <angka> } }.
    const kuota = b?.kuota && typeof b.kuota === "object" ? (b.kuota as Record<string, unknown>) : null;

    await prisma.$transaction(async tx => {
      if (Object.keys(data).length) await tx.gelombangSpmb.update({ where: { id }, data });
      if (kuota) {
        for (const [majorId, nilai] of Object.entries(kuota)) {
          const n = Math.max(0, Number(nilai) || 0);
          if (n === 0) { await tx.kuotaSpmb.deleteMany({ where: { gelombangId: id, majorId } }); continue; }
          await tx.kuotaSpmb.upsert({
            where: { gelombangId_majorId: { gelombangId: id, majorId } },
            update: { kuota: n }, create: { gelombangId: id, majorId, kuota: n },
          });
        }
      }
    });
    await logActivity(session, { action: "UPDATE", entity: "GelombangSpmb", entityId: id, description: "Mengubah gelombang SPMB" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    // Gelombang yang sudah dipakai pendaftar TIDAK dihapus — nomor pendaftaran mereka terikat
    // ke gelombangnya. Panitia menonaktifkannya saja.
    const dipakai = await prisma.admission.count({ where: { gelombangId: id } });
    if (dipakai > 0) return NextResponse.json({ error: `Gelombang ini sudah dipakai ${dipakai} pendaftar. Nonaktifkan saja, jangan dihapus.` }, { status: 409 });
    await prisma.gelombangSpmb.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "GelombangSpmb", entityId: id, description: "Menghapus gelombang SPMB" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
