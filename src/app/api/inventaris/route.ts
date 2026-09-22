import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan, getJabatanNames } from "@/lib/jabatan-guard";
import { isLabAsset, LAB_ASSET_FILTER } from "@/lib/inventaris-scope";

export const dynamic = "force-dynamic";

/** Kepala Lab (tanpa jabatan Sarpras) hanya boleh lihat/kelola aset berkategori/lokasi lab.
 * Wakasek Sarpras (dan Admin/TAS) tetap lihat semua aset — dia pemilik domain sarana-prasarana secara keseluruhan. */
async function resolveLabOnly(session: { role: string; email: string }): Promise<boolean> {
  if (session.role !== "TEACHER") return false;
  const names = await getJabatanNames(session.email);
  return names.includes("Kepala Laboratorium") && !names.includes("Wakil Kepala Sarana Prasarana");
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
    const labOnly = await resolveLabOnly(session);

    const assets = await prisma.asset.findMany({
      where: labOnly ? LAB_ASSET_FILTER : undefined,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
    const labOnly = await resolveLabOnly(session);

    const body = await req.json();
    const { name, category, quantity, condition, location, acquiredDate, fundingSource, notes, kodeInventaris } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "Nama barang dan kategori wajib diisi" }, { status: 400 });
    }
    if (labOnly && !isLabAsset({ category, location })) {
      return NextResponse.json({ error: "Kepala Laboratorium hanya bisa menambah barang dengan kategori/lokasi yang mengandung kata 'Lab' (contoh: \"Peralatan Laboratorium\")." }, { status: 403 });
    }

    const asset = await prisma.asset.create({
      data: {
        name, category,
        quantity: quantity ? parseInt(quantity) : 1,
        condition: condition || "BAIK",
        location: location || null,
        acquiredDate: acquiredDate ? new Date(acquiredDate) : null,
        fundingSource: fundingSource || null,
        notes: notes || null,
        kodeInventaris: kodeInventaris ? String(kodeInventaris).trim().slice(0, 60) : null,
      },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan barang" }, { status: 500 });
  }
}
