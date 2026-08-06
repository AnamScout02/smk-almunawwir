import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { id } = await params;
    const body = await req.json();
    const { action, dueDate } = body;

    if (action === "CONVERT") {
      if (!dueDate) return NextResponse.json({ error: "Jatuh tempo wajib diisi" }, { status: 400 });
      const reservation = await prisma.bookReservation.findUnique({ where: { id } });
      if (!reservation) return NextResponse.json({ error: "Reservasi tidak ditemukan" }, { status: 404 });

      const [book, activeCount] = await Promise.all([
        prisma.book.findUnique({ where: { id: reservation.bookId } }),
        prisma.bookLoan.count({ where: { bookId: reservation.bookId, status: "DIPINJAM" } }),
      ]);
      if (!book) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });
      if (activeCount >= book.stock) {
        return NextResponse.json({ error: "Belum ada eksemplar tersedia untuk buku ini" }, { status: 409 });
      }

      await prisma.$transaction([
        prisma.bookLoan.create({ data: { bookId: reservation.bookId, borrowerId: reservation.borrowerId, dueDate: new Date(dueDate) } }),
        prisma.bookReservation.update({ where: { id }, data: { status: "SELESAI" } }),
      ]);
      return NextResponse.json({ success: true });
    }

    const { status } = body;
    if (!status) return NextResponse.json({ error: "Status wajib diisi" }, { status: 400 });
    await prisma.bookReservation.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan reservations PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { id } = await params;
    await prisma.bookReservation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan reservations DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus reservasi" }, { status: 500 });
  }
}
