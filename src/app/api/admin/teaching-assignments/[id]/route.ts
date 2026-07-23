import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const { teacherId } = body;
  if (!teacherId) {
    return NextResponse.json({ error: "Guru wajib dipilih" }, { status: 400 });
  }
  const item = await prisma.teachingAssignment.update({
    where: { id },
    data: { teacherId },
    include: {
      subject: true,
      teacher: { include: { user: { select: { name: true } } } },
      preferences: true,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  await prisma.teachingAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
