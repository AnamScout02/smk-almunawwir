import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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
    lemparBilaPengalihan(e);
    console.error(e);
    return NextResponse.json({ error: "Gagal mengambil data arsip" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { judul, kategori, nomor, tanggal, keterangan, fileUrl, berlakuSampai } = body;

    if (!judul || !kategori || !tanggal) {
      return NextResponse.json({ error: "Judul, kategori, dan tanggal wajib diisi" }, { status: 400 });
    }

    const arsip = await prisma.arsip.create({
      data: { judul, kategori, nomor: nomor || null, tanggal: new Date(tanggal), keterangan: keterangan || null, fileUrl: fileUrl || null, berlakuSampai: berlakuSampai ? new Date(berlakuSampai) : null },
    });
    return NextResponse.json(arsip, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan arsip" }, { status: 500 });
  }
}
