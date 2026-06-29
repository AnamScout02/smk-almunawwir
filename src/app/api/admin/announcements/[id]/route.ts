import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;
  const body = await req.json();
  const { title, content, targetRole, priority, active, startDate, endDate } = body;
  const item = await prisma.announcement.update({
    where: { id },
    data: {
      title: title?.trim(),
      content: content?.trim(),
      targetRole,
      priority,
      active,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
