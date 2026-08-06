import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const surat = await prisma.surat.findUnique({ where: { id } });
    if (!surat) return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    return NextResponse.json(surat);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  const body = await req.json();
  const { nomor, tanggal, pihak, perihal, keterangan, fileUrl, isRead, klasifikasi, content, penandaTangan } = body;

  const surat = await prisma.surat.update({
    where: { id },
    data: {
      nomor:      nomor || undefined,
      tanggal:    tanggal ? new Date(tanggal) : undefined,
      pihak:      pihak || undefined,
      perihal:    perihal || undefined,
      keterangan: keterangan ?? null,
      fileUrl:    fileUrl ?? null,
      ...(isRead !== undefined ? { isRead } : {}),
      ...(klasifikasi !== undefined ? { klasifikasi: klasifikasi || null } : {}),
      ...(content !== undefined ? { content: content || null } : {}),
      ...(penandaTangan !== undefined ? { penandaTangan: penandaTangan || null } : {}),
    },
  });
  return NextResponse.json(surat);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  await prisma.surat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
