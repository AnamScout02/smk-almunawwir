import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertDutyRosterAccess } from "@/lib/kedisiplinan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertDutyRosterAccess(session);

    const { id } = await params;
    await prisma.dutyRoster.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[duty-roster DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
