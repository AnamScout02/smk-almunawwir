import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const { code, name, category, grade, majorId, order, hoursPerWeek, weekGroup, maxSharedTeacher } = body;

  if (!name || !category || !grade) {
    return NextResponse.json({ error: "Nama, kategori, dan tingkat wajib diisi" }, { status: 400 });
  }

  const subject = await prisma.subject.update({
    where: { id },
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
  return NextResponse.json(subject);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
