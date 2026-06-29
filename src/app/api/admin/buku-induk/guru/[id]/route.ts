import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const {
    birthPlace, birthDate, gender, religion, address,
    education, position, startDate, teacherStatus, teacherNotes, phone,
  } = body;

  const teacher = await prisma.teacher.update({
    where: { id },
    data: {
      phone:         phone || null,
      birthPlace:    birthPlace || null,
      birthDate:     birthDate ? new Date(birthDate) : null,
      gender:        gender || null,
      religion:      religion || null,
      address:       address || null,
      education:     education || null,
      position:      position || null,
      startDate:     startDate ? new Date(startDate) : null,
      teacherStatus: teacherStatus || "AKTIF",
      teacherNotes:  teacherNotes || null,
    },
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: { select: { name: true } },
    },
  });
  return NextResponse.json(teacher);
}
