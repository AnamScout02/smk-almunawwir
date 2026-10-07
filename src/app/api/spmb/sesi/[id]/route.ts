import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { rapikanSesi } from "@/lib/spmb-sesi";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    const r = rapikanSesi(await req.json().catch(() => ({})));
    if (!r.data) return NextResponse.json({ error: r.galat }, { status: 400 });
    const terisi = await prisma.admission.count({ where: { sesiId: id } });
    if (r.data.kuota < terisi) return NextResponse.json({ error: `Sudah ${terisi} calon memilih sesi ini — kuota tidak boleh di bawahnya.` }, { status: 409 });
    await prisma.sesiSpmb.update({ where: { id }, data: r.data });
    await logActivity(session, { action: "UPDATE", entity: "SesiSpmb", entityId: id, description: "Mengubah sesi kedatangan SPMB" }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    // Sesi yang sudah dipilih calon tidak dihapus diam-diam — calon akan kehilangan jadwalnya.
    const terisi = await prisma.admission.count({ where: { sesiId: id } });
    if (terisi) return NextResponse.json({ error: `Sudah ${terisi} calon memilih sesi ini. Pindahkan mereka dulu.` }, { status: 409 });
    await prisma.sesiSpmb.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "SesiSpmb", entityId: id, description: "Menghapus sesi kedatangan SPMB" }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
