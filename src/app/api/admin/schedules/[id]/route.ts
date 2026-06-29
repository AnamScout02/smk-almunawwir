import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;
  const body = await req.json();
  const { classId, teacherId, subject, day, startTime, endTime, room } = body;
  const item = await prisma.schedule.update({
    where: { id },
    data: { classId, teacherId: teacherId || null, subject, day, startTime, endTime, room: room || null },
    include: {
      class: { include: { major: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;
  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
