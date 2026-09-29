import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const { id } = await params;
    const body = await req.json();
    const { teacherId } = body;
    if (!teacherId) {
      return NextResponse.json({ error: "Guru wajib dipilih" }, { status: 400 });
    }
    const item = await prisma.teachingAssignment.update({
      where: { id },
      data: { teacherId },
      include: {
        subject: true,
        teacher: { include: { user: { select: { name: true } } } },
        preferences: true,
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal mengupdate penugasan mengajar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const { id } = await params;
    await prisma.teachingAssignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menghapus penugasan mengajar" }, { status: 500 });
  }
}
