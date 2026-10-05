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
    const lama = await prisma.komponenNilaiSpmb.findUnique({ where: { id }, select: { jenis: true, _count: { select: { nilai: true } } } });
    if (!lama) return NextResponse.json({ error: "Komponen tidak ditemukan" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof b?.nama === "string" && b.nama.trim()) data.nama = b.nama.trim();
    if (typeof b?.aktif === "boolean") data.aktif = b.aktif;
    if (typeof b?.urutan === "number") data.urutan = Math.max(1, Math.round(b.urutan));
    // JENIS dikunci begitu ada nilai masuk: mengubah ANGKA → LULUS_TIDAK membuat angka yang sudah
    // dinilai panitia tidak punya arti lagi, dan skor seluruh pendaftar berubah diam-diam.
    if (b?.jenis && b.jenis !== lama.jenis) {
      if (lama._count.nilai > 0) return NextResponse.json({ error: "Jenis komponen tidak bisa diubah karena sudah ada nilai masuk. Nonaktifkan komponen ini lalu buat yang baru." }, { status: 409 });
      data.jenis = ["LULUS_TIDAK", "PRESTASI"].includes(b.jenis) ? b.jenis : "ANGKA";
    }
    const jenisAkhir = (data.jenis as string) ?? lama.jenis;
    if (b?.bobot !== undefined) data.bobot = jenisAkhir === "LULUS_TIDAK" ? 0 : Math.max(1, Number(b.bobot) || 1);
    if (b?.nilaiMaks !== undefined) data.nilaiMaks = Math.max(1, Number(b.nilaiMaks) || 100);

    await prisma.komponenNilaiSpmb.update({ where: { id }, data });
    await logActivity(session, { action: "UPDATE", entity: "KomponenNilaiSpmb", entityId: id, description: "Mengubah komponen nilai SPMB" });
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
    const dipakai = await prisma.nilaiSpmb.count({ where: { komponenId: id } });
    if (dipakai > 0) return NextResponse.json({ error: `Komponen ini sudah dipakai menilai ${dipakai} pendaftar. Nonaktifkan saja.` }, { status: 409 });
    await prisma.komponenNilaiSpmb.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "KomponenNilaiSpmb", entityId: id, description: "Menghapus komponen nilai SPMB" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
