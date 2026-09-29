import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertUks } from "@/lib/uks-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const { id } = await params;
    const body = await req.json();
    const { name, stock, unit, notes, kedaluwarsa, stokMinimum } = body;

    const medicine = await prisma.uksMedicine.update({
      where: { id },
      data: {
        name: name || undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        unit: unit || undefined,
        notes: notes ?? undefined,
        kedaluwarsa: kedaluwarsa === undefined ? undefined : kedaluwarsa ? new Date(kedaluwarsa) : null,
        stokMinimum: stokMinimum === undefined ? undefined : Math.max(0, Math.round(Number(stokMinimum)) || 0),
      },
    });
    return NextResponse.json(medicine);
  } catch (e) {
    lemparBilaPengalihan(e);
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
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks medicines DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus obat" }, { status: 500 });
  }
}
