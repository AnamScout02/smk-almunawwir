import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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
    lemparBilaPengalihan(e);
    console.error(e);
    return NextResponse.json({ error: "Gagal mengambil data surat" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { tipe, nomor, tanggal, pihak, perihal, keterangan, fileUrl, klasifikasi, content, penandaTangan, templateValue, templateIsi } = body;

    // `pihak` TIDAK wajib untuk surat KELUAR: Surat Keterangan, Pernyataan, dan SK memang tidak
    // punya alamat tujuan. Untuk surat MASUK tetap wajib — itu asal suratnya.
    if (!tipe || !nomor || !tanggal || !perihal || (tipe === "MASUK" && !pihak)) {
      return NextResponse.json({ error: "Tipe, nomor, tanggal, dan perihal wajib diisi (surat masuk juga wajib mengisi pengirim)" }, { status: 400 });
    }

    const surat = await prisma.surat.create({
      data: {
        tipe, nomor, tanggal: new Date(tanggal), pihak: pihak ?? "", perihal, keterangan: keterangan || null, fileUrl: fileUrl || null,
        klasifikasi: klasifikasi || null, content: content || null, penandaTangan: penandaTangan || null,
        templateValue: templateValue || null, templateIsi: templateIsi ?? undefined,
      },
    });
    return NextResponse.json(surat, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error(e);
    return NextResponse.json({ error: "Gagal menyimpan surat" }, { status: 500 });
  }
}
