import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

// Bobot KPI berlaku sekolah — sengaja cuma ADMIN yang boleh atur (bukan level Wakasek), sama
// alasannya dengan Pengaturan Poin Kedisiplinan.
export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const indicators = await prisma.kpiIndicator.findMany({ orderBy: [{ jabatanName: "asc" }, { order: "asc" }] });
    return NextResponse.json(indicators);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const { jabatanName, name, weight, source, order } = body;
    if (!jabatanName || !name || !source || typeof weight !== "number") {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }
    const indicator = await prisma.kpiIndicator.create({
      data: { jabatanName, name, weight, source, order: order ?? 0 },
    });
    return NextResponse.json(indicator, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Indikator dengan nama itu sudah ada untuk jabatan ini" }, { status: 409 });
    }
    console.error("[kpi indicators POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan indikator" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const { id, weight, active, order } = body;
    if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

    const data: { weight?: number; active?: boolean; order?: number } = {};
    if (typeof weight === "number") data.weight = weight;
    if (typeof active === "boolean") data.active = active;
    if (typeof order === "number") data.order = order;

    const indicator = await prisma.kpiIndicator.update({ where: { id }, data });
    return NextResponse.json(indicator);
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[kpi indicators PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}
