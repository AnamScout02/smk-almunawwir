import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  const body = await req.json();
  const { judul, kategori, nomor, tanggal, keterangan, fileUrl, berlakuSampai } = body;

  const arsip = await prisma.arsip.update({
    where: { id },
    data: {
      judul:      judul || undefined,
      kategori:   kategori || undefined,
      nomor:      nomor ?? null,
      tanggal:    tanggal ? new Date(tanggal) : undefined,
      keterangan: keterangan ?? null,
      fileUrl:    fileUrl ?? null,
    },
  });
  return NextResponse.json(arsip);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  await prisma.arsip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
