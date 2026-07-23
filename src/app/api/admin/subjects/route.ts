import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  const subjects = await prisma.subject.findMany({
    include: { major: { select: { id: true, name: true, code: true } } },
    orderBy: [{ grade: "asc" }, { category: "asc" }, { order: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { code, name, category, grade, majorId, order, hoursPerWeek, weekGroup, maxSharedTeacher } = body;

  if (!name || !category || !grade) {
    return NextResponse.json({ error: "Nama, kategori, dan tingkat wajib diisi" }, { status: 400 });
  }

  const subject = await prisma.subject.create({
    data: {
      code: code ? parseInt(String(code)) : 0,
      name,
      category,
      grade: parseInt(String(grade)),
      majorId: majorId || null,
      order: order ? parseInt(String(order)) : 0,
      hoursPerWeek: hoursPerWeek ? parseInt(String(hoursPerWeek)) : 2,
      weekGroup: weekGroup === "PRODUKTIF" ? "PRODUKTIF" : "UMUM",
      maxSharedTeacher: maxSharedTeacher ? Math.max(1, parseInt(String(maxSharedTeacher))) : 1,
    },
    include: { major: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(subject, { status: 201 });
}
