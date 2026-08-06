import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const tipe = searchParams.get("tipe");

    const surat = await prisma.surat.findMany({
      where: tipe ? { tipe } : undefined,
      orderBy: { tanggal: "desc" },
    });
    return NextResponse.json(surat);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal mengambil data surat" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { tipe, nomor, tanggal, pihak, perihal, keterangan, fileUrl, klasifikasi, content, penandaTangan } = body;

    if (!tipe || !nomor || !tanggal || !pihak || !perihal) {
      return NextResponse.json({ error: "Tipe, nomor, tanggal, pihak, dan perihal wajib diisi" }, { status: 400 });
    }

    const surat = await prisma.surat.create({
      data: {
        tipe, nomor, tanggal: new Date(tanggal), pihak, perihal, keterangan: keterangan || null, fileUrl: fileUrl || null,
        klasifikasi: klasifikasi || null, content: content || null, penandaTangan: penandaTangan || null,
      },
    });
    return NextResponse.json(surat, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan surat" }, { status: 500 });
  }
}
