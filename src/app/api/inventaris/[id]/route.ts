import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan, getJabatanNames } from "@/lib/jabatan-guard";
import { isLabAsset } from "@/lib/inventaris-scope";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

async function resolveLabOnly(session: { role: string; email: string }): Promise<boolean> {
  if (session.role !== "TEACHER") return false;
  const names = await getJabatanNames(session.email);
  return names.includes("Kepala Laboratorium") && !names.includes("Wakil Kepala Sarana Prasarana");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
    const labOnly = await resolveLabOnly(session);

    const { id } = await params;
    const body = await req.json();
    const { name, category, quantity, condition, location, acquiredDate, fundingSource, notes, kodeInventaris } = body;
    const sebelum = await prisma.asset.findUnique({ where: { id }, select: { location: true } });

    if (labOnly) {
      const existing = await prisma.asset.findUnique({ where: { id }, select: { category: true, location: true } });
      if (!existing || !isLabAsset(existing)) {
        return NextResponse.json({ error: "Barang ini bukan aset Lab — hanya Wakasek Sarpras yang bisa mengubahnya." }, { status: 403 });
      }
      const nextCategory = category || existing.category;
      const nextLocation = location !== undefined ? location : existing.location;
      if (!isLabAsset({ category: nextCategory, location: nextLocation })) {
        return NextResponse.json({ error: "Kepala Laboratorium hanya bisa menyimpan barang dengan kategori/lokasi yang mengandung kata 'Lab'." }, { status: 403 });
      }
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        name: name || undefined,
        category: category || undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
        condition: condition || undefined,
        location: location ?? undefined,
        acquiredDate: acquiredDate === null ? null : acquiredDate ? new Date(acquiredDate) : undefined,
        fundingSource: fundingSource ?? undefined,
        notes: notes ?? undefined,
        kodeInventaris: kodeInventaris === undefined ? undefined : (String(kodeInventaris).trim().slice(0, 60) || null),
      },
    });
    // Riwayat mutasi ruang (17 Sep 2026): setiap perubahan lokasi tercatat.
    if (sebelum && location !== undefined && (sebelum.location ?? "") !== (asset.location ?? "")) {
      await prisma.mutasiAset.create({ data: { assetId: id, dari: sebelum.location, ke: asset.location, olehNama: session.name, catatan: typeof body.catatanMutasi === "string" ? body.catatanMutasi.slice(0, 300) : null } }).catch(() => null);
    }
    return NextResponse.json(asset);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
    const labOnly = await resolveLabOnly(session);

    const { id } = await params;
    if (labOnly) {
      const existing = await prisma.asset.findUnique({ where: { id }, select: { category: true, location: true } });
      if (!existing || !isLabAsset(existing)) {
        return NextResponse.json({ error: "Barang ini bukan aset Lab — hanya Wakasek Sarpras yang bisa menghapusnya." }, { status: 403 });
      }
    }
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus barang" }, { status: 500 });
  }
}
