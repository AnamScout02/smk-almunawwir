import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b?.nama === "string" && b.nama.trim()) data.nama = b.nama.trim();
    if (b?.keterangan !== undefined) data.keterangan = String(b.keterangan ?? "").trim() || null;
    if (typeof b?.wajib === "boolean") data.wajib = b.wajib;
    if (typeof b?.aktif === "boolean") data.aktif = b.aktif;
    if (typeof b?.urutan === "number") data.urutan = Math.max(1, Math.round(b.urutan));
    await prisma.dokumenSyaratSpmb.update({ where: { id }, data });
    await logActivity(session, { action: "UPDATE", entity: "DokumenSyaratSpmb", entityId: id, description: "Mengubah dokumen syarat SPMB" });
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
    const dipakai = await prisma.berkasSpmb.count({ where: { syaratId: id } });
    if (dipakai > 0) return NextResponse.json({ error: `Sudah ada ${dipakai} berkas pendaftar untuk syarat ini. Nonaktifkan saja.` }, { status: 409 });
    await prisma.dokumenSyaratSpmb.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "DokumenSyaratSpmb", entityId: id, description: "Menghapus dokumen syarat SPMB" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
