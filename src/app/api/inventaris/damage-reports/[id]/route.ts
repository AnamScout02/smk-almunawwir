import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { segarkanAntrean } from "@/lib/antrean-kerja";

async function guard(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await guard(session);

    const { id } = await params;
    const body = await req.json();
    const { status, repairNotes, description } = body;

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      if (status === "SELESAI") data.repairDate = new Date();
    }
    if (repairNotes !== undefined) data.repairNotes = repairNotes || null;
    if (description !== undefined) data.description = description;

    const lama = await prisma.assetDamageReport.findUnique({ where: { id }, select: { status: true } });
    const report = await prisma.assetDamageReport.update({
      where: { id },
      data,
      include: { asset: { select: { name: true, category: true, location: true } } },
    });
    // Kabar ke pelapor saat status perbaikan berubah.
    if (status && lama && lama.status !== status && report.pelaporId && report.pelaporId !== session.userId) {
      const label = status === "SELESAI" ? "sudah diperbaiki" : status === "SEDANG_DIPERBAIKI" ? "sedang diperbaiki" : "belum diperbaiki";
      kirimLatar(() => kirimNotifikasi({
        userIds: [report.pelaporId!], jenis: "SARPRAS", kunci: `kerusakan-status:${id}:${status}`,
        judul: `Laporan kerusakan ${label}`,
        isi: `${report.asset?.name ?? report.judul ?? "Kerusakan"}${report.lokasi ? ` · ${report.lokasi}` : ""}${report.repairNotes ? ` — ${report.repairNotes}` : ""}`,
        url: "/layanan-sarpras", tag: `kerusakan-${id}`,
      }));
    }
    segarkanAntrean();
    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris damage-reports PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await guard(session);

    const { id } = await params;
    await prisma.assetDamageReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris damage-reports DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus laporan" }, { status: 500 });
  }
}
