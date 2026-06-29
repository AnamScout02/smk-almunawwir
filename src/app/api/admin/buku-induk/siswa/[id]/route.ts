import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN"]);
  const { id } = await params;
  const body = await req.json();
  const {
    noInduk, nisn, birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, previousSchool, enrollYear,
    studentStatus, exitDate, studentNotes,
    bukuIndukData,
  } = body;

  const student = await prisma.student.update({
    where: { id },
    data: {
      noInduk:        noInduk || null,
      nisn:           nisn || null,
      birthPlace:     birthPlace || null,
      birthDate:      birthDate ? new Date(birthDate) : null,
      gender:         gender || null,
      religion:       religion || null,
      address:        address || null,
      parentName:     parentName || null,
      parentPhone:    parentPhone || null,
      parentJob:      parentJob || null,
      previousSchool: previousSchool || null,
      enrollYear:     enrollYear ? parseInt(enrollYear) : null,
      studentStatus:  studentStatus || "AKTIF",
      exitDate:       exitDate ? new Date(exitDate) : null,
      studentNotes:   studentNotes || null,
      bukuIndukData:  bukuIndukData ?? undefined,
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true } },
      major: { select: { name: true, code: true } },
    },
  });
  return NextResponse.json(student);
}
