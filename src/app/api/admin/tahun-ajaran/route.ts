import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);

  const years = await prisma.academicYear.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { studentHistory: true } },
    },
  });

  return NextResponse.json(years);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN"]);

  const body = await req.json();
  const { name, startDate, endDate, notes } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Nama tahun ajaran wajib diisi" }, { status: 400 });
  }

  // Cek duplikat
  const existing = await prisma.academicYear.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Nama tahun ajaran sudah ada" }, { status: 409 });
  }

  // Cek apakah ini tahun ajaran pertama
  const count = await prisma.academicYear.count();
  const isFirst = count === 0;

  const year = await prisma.academicYear.create({
    data: {
      name: name.trim(),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(),
      notes: notes ?? null,
      isActive: isFirst,
    },
  });

  return NextResponse.json(year, { status: 201 });
}
