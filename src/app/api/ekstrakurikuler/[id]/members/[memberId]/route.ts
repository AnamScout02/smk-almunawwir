import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertExtracurricularAccess, getExtracurricularById } from "@/lib/ekstrakurikuler-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { id, memberId } = await params;
    const ekskul = await getExtracurricularById(id);
    if (!ekskul) return NextResponse.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    await prisma.extracurricularMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Anda bukan pembina ekstrakurikuler ini." }, { status: 403 });
    }
    console.error("[ekskul members DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus anggota" }, { status: 500 });
  }
}
