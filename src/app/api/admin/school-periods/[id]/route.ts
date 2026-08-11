import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  const body = await req.json();
  const { day, order, startTime, endTime, isBreak, label } = body;
  if (!day || !order || !startTime || !endTime) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    const period = await prisma.schoolPeriod.update({
      where: { id },
      data: {
        day,
        order: parseInt(String(order)),
        startTime,
        endTime,
        isBreak: !!isBreak,
        label: label || null,
      },
    });
    return NextResponse.json(period);
  } catch {
    return NextResponse.json({ error: "Jam ke- itu sudah ada di hari tersebut" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  await prisma.schoolPeriod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
