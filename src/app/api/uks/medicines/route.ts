import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertUks } from "@/lib/uks-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const medicines = await prisma.uksMedicine.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(medicines);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const body = await req.json();
    const { name, stock, unit, notes, kedaluwarsa, stokMinimum } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama obat wajib diisi" }, { status: 400 });
    }

    const medicine = await prisma.uksMedicine.create({
      data: { name, stock: Number(stock) || 0, unit: unit || "pcs", notes: notes || null, kedaluwarsa: kedaluwarsa ? new Date(kedaluwarsa) : null, stokMinimum: Math.max(0, Math.round(Number(stokMinimum ?? 5)) || 0) },
    });
    return NextResponse.json(medicine, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks medicines POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan obat" }, { status: 500 });
  }
}
