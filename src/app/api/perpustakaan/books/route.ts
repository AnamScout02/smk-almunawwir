import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Barcode otomatis PST-{5 digit} berbasis jumlah buku saat ini — retry dgn suffix acak kalau bentrok. */
async function generateBarcode(): Promise<string> {
  const count = await prisma.book.count();
  const base = `PST-${String(count + 1).padStart(5, "0")}`;
  const existing = await prisma.book.findUnique({ where: { barcode: base } });
  if (!existing) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const [books, activeLoans] = await Promise.all([
      prisma.book.findMany({ orderBy: { title: "asc" } }),
      prisma.bookLoan.findMany({ where: { status: "DIPINJAM" }, select: { bookId: true } }),
    ]);

    const activeByBook = new Map<string, number>();
    for (const l of activeLoans) activeByBook.set(l.bookId, (activeByBook.get(l.bookId) ?? 0) + 1);

    const withExtras = await Promise.all(books.map(async b => ({
      ...b,
      borrowed: activeByBook.get(b.id) ?? 0,
      available: b.stock - (activeByBook.get(b.id) ?? 0),
      barcodeQr: b.barcode ? await generateQrWithLogoDataUrl(b.barcode) : null,
    })));

    return NextResponse.json(withExtras);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const body = await req.json();
    const { title, author, publisher, category, stock, location, coverUrl, barcode, fileUrl } = body;

    if (!title || !category) {
      return NextResponse.json({ error: "Judul dan kategori wajib diisi" }, { status: 400 });
    }

    const book = await prisma.book.create({
      data: {
        title, category,
        author: author || null, publisher: publisher || null,
        stock: stock ? parseInt(stock) : 1,
        location: location || null,
        coverUrl: coverUrl || null,
        barcode: barcode || await generateBarcode(),
        fileUrl: fileUrl || null,
      },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "Barcode ini sudah dipakai buku lain" }, { status: 409 });
    }
    console.error("[perpustakaan books POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan buku" }, { status: 500 });
  }
}
