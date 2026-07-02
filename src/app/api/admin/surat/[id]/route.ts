import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const { nomor, tanggal, pihak, perihal, keterangan, fileUrl, isRead } = body;

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
    },
  });
  return NextResponse.json(surat);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  await prisma.surat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
