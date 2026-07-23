import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const classId = req.nextUrl.searchParams.get("classId");
  const items = await prisma.teachingAssignment.findMany({
    where: classId ? { classId } : undefined,
    include: {
      subject: true,
      teacher: { include: { user: { select: { name: true } } } },
      preferences: { orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { classId, subjectId, teacherId } = body;
  if (!classId || !subjectId || !teacherId) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    const item = await prisma.teachingAssignment.create({
      data: { classId, subjectId, teacherId },
      include: {
        subject: true,
        teacher: { include: { user: { select: { name: true } } } },
        preferences: true,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Mata pelajaran ini sudah punya guru pengampu di kelas tersebut" }, { status: 400 });
  }
}
