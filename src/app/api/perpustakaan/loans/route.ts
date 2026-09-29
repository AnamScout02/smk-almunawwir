import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function calcFine(dueDate: Date, endDate: Date, dendaPerHari: number) {
  const daysLate = Math.max(0, Math.ceil((endDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
  return { daysLate, fineAmount: daysLate * dendaPerHari };
}

export const dynamic = "force-dynamic";

const BORROWER_INCLUDE = {
  select: {
    name: true, role: true,
    student: { select: { nis: true, class: { select: { name: true } } } },
    teacher: { select: { nip: true } },
  },
} as const;

function shapeBorrower(borrower: { name: string; role: string; student: { nis: string; class: { name: string } | null } | null; teacher: { nip: string } | null }) {
  if (borrower.student) {
    return { name: borrower.name, type: "SISWA" as const, identifier: borrower.student.nis, className: borrower.student.class?.name ?? "—" };
  }
  if (borrower.teacher) {
    return { name: borrower.name, type: "GURU" as const, identifier: borrower.teacher.nip, className: null };
  }
  return { name: borrower.name, type: "PEGAWAI" as const, identifier: "-", className: null };
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get("status") === "active";

    const [loans, settings] = await Promise.all([
      prisma.bookLoan.findMany({
        where: onlyActive ? { status: "DIPINJAM" } : undefined,
        include: { book: { select: { title: true, barcode: true } }, borrower: BORROWER_INCLUDE },
        orderBy: { borrowDate: "desc" },
      }),
      getSettings(["perpustakaan.dendaPerHari"]),
    ]);
    const dendaPerHari = Number(settings["perpustakaan.dendaPerHari"] ?? 0);

    const now = new Date();
    return NextResponse.json(loans.map(l => {
      const dueDate = new Date(l.dueDate);
      const endDate = l.returnDate ? new Date(l.returnDate) : now;
      const isOverdue = l.status === "DIPINJAM" && dueDate < now;
      const { daysLate, fineAmount } = (isOverdue || (l.status === "DIKEMBALIKAN" && l.returnDate && dueDate < endDate))
        ? calcFine(dueDate, endDate, dendaPerHari) : { daysLate: 0, fineAmount: 0 };
      return { ...l, borrower: shapeBorrower(l.borrower), isOverdue, daysLate, fineAmount };
    }));
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
    const { bookId, borrowerId, dueDate, notes } = body;

    if (!bookId || !borrowerId || !dueDate) {
      return NextResponse.json({ error: "Buku, peminjam, dan jatuh tempo wajib diisi" }, { status: 400 });
    }

    const [book, activeCount] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.bookLoan.count({ where: { bookId, status: "DIPINJAM" } }),
    ]);
    if (!book) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });
    if (activeCount >= book.stock) {
      return NextResponse.json({ error: "Tidak ada eksemplar tersedia untuk buku ini" }, { status: 409 });
    }

    const loan = await prisma.bookLoan.create({
      data: { bookId, borrowerId, dueDate: new Date(dueDate), notes: notes || null },
      include: { book: { select: { title: true, barcode: true } }, borrower: BORROWER_INCLUDE },
    });
    return NextResponse.json({ ...loan, borrower: shapeBorrower(loan.borrower) }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan loans POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan peminjaman" }, { status: 500 });
  }
}
