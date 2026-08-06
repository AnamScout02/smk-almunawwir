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
    const { visitDate, complaint, treatment, notes } = body;

    const visit = await prisma.uksVisit.update({
      where: { id },
      data: {
        visitDate: visitDate ? new Date(visitDate) : undefined,
        complaint: complaint || undefined,
        treatment: treatment ?? undefined,
        notes: notes ?? undefined,
      },
      include: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    });
    return NextResponse.json(visit);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks visits PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const { id } = await params;
    await prisma.uksVisit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks visits DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus kunjungan" }, { status: 500 });
  }
}
