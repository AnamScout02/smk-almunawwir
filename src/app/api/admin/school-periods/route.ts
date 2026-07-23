import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const periods = await prisma.schoolPeriod.findMany({
    orderBy: [{ day: "asc" }, { order: "asc" }],
  });
  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { day, order, startTime, endTime, isBreak, label } = body;
  if (!day || !order || !startTime || !endTime) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    const period = await prisma.schoolPeriod.create({
      data: {
        day,
        order: parseInt(String(order)),
        startTime,
        endTime,
        isBreak: !!isBreak,
        label: label || null,
      },
    });
    return NextResponse.json(period, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Jam ke- itu sudah ada di hari tersebut" }, { status: 400 });
  }
}
