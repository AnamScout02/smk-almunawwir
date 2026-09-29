import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { id } = await params;
    const body = await req.json();
    const { action, dueDate, notes } = body;

    const data: Record<string, unknown> = {};
    if (action === "RETURN") {
      data.status = "DIKEMBALIKAN";
      data.returnDate = new Date();
    }
    if (action === "MARK_PAID") {
      data.finePaid = true;
    }
    if (dueDate) data.dueDate = new Date(dueDate);
    if (notes !== undefined) data.notes = notes || null;

    const loan = await prisma.bookLoan.update({
      where: { id },
      data,
      include: { book: { select: { title: true, barcode: true } }, borrower: BORROWER_INCLUDE },
    });
    return NextResponse.json({ ...loan, borrower: shapeBorrower(loan.borrower) });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan loans PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}
