import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { rapikanKode } from "@/lib/spmb-perujuk";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { id } = await params;
    const b = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof b?.kode === "string" && b.kode.trim()) {
      const kode = rapikanKode(b.kode);
      if (kode.length < 3) return NextResponse.json({ error: "Kode minimal 3 karakter" }, { status: 400 });

      const lama = await prisma.perujukSpmb.findUnique({
        where: { id },
        select: { kode: true, _count: { select: { pendaftar: true } } },
      });
      if (!lama) return NextResponse.json({ error: "Perujuk tidak ditemukan" }, { status: 404 });

      // KODE TERKUNCI begitu sudah membawa pendaftar. Tautan & QR dengan kode itu sudah terlanjur
      // beredar — menggantinya membuat semua yang sudah dibagikan berhenti berlaku, dan pendaftar
      // berikutnya yang memakai tautan lama tercatat sebagai "kode tidak dikenali". Dikunci di
      // SERVER, bukan hanya di layar, supaya tidak bisa dilewati lewat permintaan langsung.
      if (kode !== lama.kode && lama._count.pendaftar > 0) {
        return NextResponse.json({
          error: `Kode tidak bisa diubah: sudah dipakai ${lama._count.pendaftar} pendaftar. Tautan & QR yang sudah dibagikan akan berhenti berlaku. Bila perujuk ini harus berganti kode, nonaktifkan yang ini lalu buat perujuk baru.`,
        }, { status: 409 });
      }

      const bentrok = await prisma.perujukSpmb.findFirst({ where: { kode, NOT: { id } }, select: { nama: true } });
      if (bentrok) return NextResponse.json({ error: `Kode "${kode}" sudah dipakai ${bentrok.nama}.` }, { status: 409 });
      data.kode = kode;
    }
    if (typeof b?.nama === "string" && b.nama.trim()) data.nama = b.nama.trim();
    if (b?.jenis) data.jenis = b.jenis;
    if (b?.kontak !== undefined) data.kontak = String(b.kontak ?? "").trim() || null;
    if (b?.keterangan !== undefined) data.keterangan = String(b.keterangan ?? "").trim() || null;
    if (typeof b?.aktif === "boolean") data.aktif = b.aktif;

    await prisma.perujukSpmb.update({ where: { id }, data });
    await logActivity(session, { action: "UPDATE", entity: "PerujukSpmb", entityId: id, description: "Mengubah perujuk SPMB" });
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
    // Perujuk yang sudah membawa pendaftar TIDAK dihapus — menghapusnya memutus jejak dari mana
    // pendaftar itu datang. Nonaktifkan saja: kodenya berhenti berlaku, catatannya tetap ada.
    const dipakai = await prisma.admission.count({ where: { perujukId: id } });
    if (dipakai > 0) {
      return NextResponse.json({ error: `Perujuk ini sudah membawa ${dipakai} pendaftar. Nonaktifkan saja, jangan dihapus.` }, { status: 409 });
    }
    await prisma.perujukSpmb.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "PerujukSpmb", entityId: id, description: "Menghapus perujuk SPMB" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
