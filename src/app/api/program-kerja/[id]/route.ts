import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOwnedJabatanIds, getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

// PERBAIKAN KRITIS 2026-08-10 (temuan user) — lihat komentar sama di ../route.ts.
async function assertOwnership(session: { role: string; email: string }, jabatanId: string) {
  if (session.role === "ADMIN") return true;
  if (session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => TAS_JABATAN.includes(n))) return true;
  }
  const owned = await getOwnedJabatanIds(session.email);
  return owned.some(j => j.id === jabatanId);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { id } = await params;
  const body = await req.json();
  const { jabatanId, title, description, tanggalMulai, tanggalSelesai, status } = body;

  const existing = await prisma.programKerja.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
  if (!(await assertOwnership(session, existing.jabatanId))) {
    return NextResponse.json({ error: "Anda tidak memegang jabatan ini" }, { status: 403 });
  }
  if (jabatanId && jabatanId !== existing.jabatanId && !(await assertOwnership(session, jabatanId))) {
    return NextResponse.json({ error: "Anda tidak memegang jabatan tujuan" }, { status: 403 });
  }

  try {
    const program = await prisma.programKerja.update({
      where: { id },
      data: {
        jabatanId: jabatanId || undefined,
        title: title || undefined,
        description: description ?? undefined,
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : undefined,
        tanggalSelesai: tanggalSelesai === null ? null : tanggalSelesai ? new Date(tanggalSelesai) : undefined,
        status: status || undefined,
      },
      include: { jabatan: { select: { id: true, name: true } } },
    });
    return NextResponse.json(program);
  } catch (err) {
    console.error("[program-kerja PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { id } = await params;

  const existing = await prisma.programKerja.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
  if (!(await assertOwnership(session, existing.jabatanId))) {
    return NextResponse.json({ error: "Anda tidak memegang jabatan ini" }, { status: 403 });
  }

  try {
    await prisma.programKerja.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[program-kerja DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus program" }, { status: 500 });
  }
}
