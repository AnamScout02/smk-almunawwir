import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TEACHER"]);
  const classId = req.nextUrl.searchParams.get("classId");
  const items = await prisma.schedule.findMany({
    where: classId ? { classId } : undefined,
    include: {
      class: { include: { major: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { classId, teacherId, subject, day, startTime, endTime, room } = body;
  if (!classId || !subject || !day || !startTime || !endTime) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  const item = await prisma.schedule.create({
    data: { classId, teacherId: teacherId || null, subject, day, startTime, endTime, room: room || null },
    include: {
      class: { include: { major: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });
  return NextResponse.json(item, { status: 201 });
}
