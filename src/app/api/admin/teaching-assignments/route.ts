import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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
  let session;
  try {
    session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Mata pelajaran ini sudah punya guru pengampu di kelas tersebut" }, { status: 400 });
  }
}
