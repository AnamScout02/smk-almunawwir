import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const { code, name, category, gradeScope, majorId, order } = body;

  if (!name || !category || !gradeScope) {
    return NextResponse.json({ error: "Nama, kategori, dan jenjang wajib diisi" }, { status: 400 });
  }

  const subject = await prisma.subject.update({
    where: { id },
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
  return NextResponse.json(subject);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
