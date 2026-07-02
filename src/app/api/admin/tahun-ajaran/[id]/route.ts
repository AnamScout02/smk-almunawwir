import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;

  const body = await req.json();
  const { name, startDate, endDate, notes, isActive } = body;

  // Jika mengaktifkan tahun ajaran ini, non-aktifkan yang lain
  if (isActive === true) {
    await prisma.academicYear.updateMany({
      where: { id: { not: id } },
      data: { isActive: false },
    });
  }

  const year = await prisma.academicYear.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return NextResponse.json(year);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;

  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) {
    return NextResponse.json({ error: "Tahun ajaran tidak ditemukan" }, { status: 404 });
  }

  if (year.isActive) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus tahun ajaran yang sedang aktif" },
      { status: 400 }
    );
  }

  await prisma.academicYear.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
