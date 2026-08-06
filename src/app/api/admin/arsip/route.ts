import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const kategori = searchParams.get("kategori");

    const arsip = await prisma.arsip.findMany({
      where: kategori ? { kategori } : undefined,
      orderBy: { tanggal: "desc" },
    });
    return NextResponse.json(arsip);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal mengambil data arsip" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { judul, kategori, nomor, tanggal, keterangan, fileUrl } = body;

    if (!judul || !kategori || !tanggal) {
      return NextResponse.json({ error: "Judul, kategori, dan tanggal wajib diisi" }, { status: 400 });
    }

    const arsip = await prisma.arsip.create({
      data: { judul, kategori, nomor: nomor || null, tanggal: new Date(tanggal), keterangan: keterangan || null, fileUrl: fileUrl || null },
    });
    return NextResponse.json(arsip, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan arsip" }, { status: 500 });
  }
}
