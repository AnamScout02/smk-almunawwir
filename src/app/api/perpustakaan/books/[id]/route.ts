import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { id } = await params;
    const body = await req.json();
    const { title, author, publisher, category, stock, location, coverUrl, barcode, fileUrl } = body;

    const book = await prisma.book.update({
      where: { id },
      data: {
        title: title || undefined,
        category: category || undefined,
        author: author ?? undefined,
        publisher: publisher ?? undefined,
        stock: stock ? parseInt(stock) : undefined,
        location: location ?? undefined,
        coverUrl: coverUrl ?? undefined,
        barcode: barcode === "" ? null : (barcode ?? undefined),
        fileUrl: fileUrl ?? undefined,
      },
    });
    return NextResponse.json(book);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Barcode ini sudah dipakai buku lain" }, { status: 409 });
    }
    console.error("[perpustakaan books PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { id } = await params;
    await prisma.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan books DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus buku" }, { status: 500 });
  }
}
