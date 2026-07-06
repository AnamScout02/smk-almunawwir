import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  const subjects = await prisma.subject.findMany({
    include: { major: { select: { id: true, name: true, code: true } } },
    orderBy: [{ gradeScope: "asc" }, { category: "asc" }, { order: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { code, name, category, gradeScope, majorId, order } = body;

  if (!name || !category || !gradeScope) {
    return NextResponse.json({ error: "Nama, kategori, dan jenjang wajib diisi" }, { status: 400 });
  }

  const subject = await prisma.subject.create({
    data: {
      code: code ? parseInt(String(code)) : 0,
      name,
      category,
      gradeScope,
      majorId: majorId || null,
      order: order ? parseInt(String(order)) : 0,
    },
    include: { major: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(subject, { status: 201 });
}
