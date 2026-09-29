import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const reservations = await prisma.bookReservation.findMany({
      where: { status: { in: ["MENUNGGU", "TERSEDIA"] } },
      include: { book: { select: { title: true, barcode: true, stock: true } }, borrower: BORROWER_INCLUDE },
      orderBy: { reservedDate: "asc" },
    });
    return NextResponse.json(reservations.map(r => ({ ...r, borrower: shapeBorrower(r.borrower) })));
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
    const { bookId, borrowerId, notes } = body;
    if (!bookId || !borrowerId) {
      return NextResponse.json({ error: "Buku dan peminjam wajib diisi" }, { status: 400 });
    }

    const reservation = await prisma.bookReservation.create({
      data: { bookId, borrowerId, notes: notes || null },
      include: { book: { select: { title: true, barcode: true, stock: true } }, borrower: BORROWER_INCLUDE },
    });
    return NextResponse.json({ ...reservation, borrower: shapeBorrower(reservation.borrower) }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan reservations POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan reservasi" }, { status: 500 });
  }
}
