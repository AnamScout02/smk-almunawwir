import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertUks } from "@/lib/uks-guard";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const { id } = await params;
    const body = await req.json();
    const { name, stock, unit, notes } = body;

    const medicine = await prisma.uksMedicine.update({
      where: { id },
      data: {
        name: name || undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        unit: unit || undefined,
        notes: notes ?? undefined,
      },
    });
    return NextResponse.json(medicine);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks medicines PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const { id } = await params;
    await prisma.uksMedicine.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks medicines DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus obat" }, { status: 500 });
  }
}
