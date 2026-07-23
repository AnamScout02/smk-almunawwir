import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const students = await prisma.student.findMany({
    where: classId ? { classId } : undefined,
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
    orderBy: [{ enrollYear: "desc" }, { user: { name: "asc" } }],
  });
  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);

  const body = await req.json();
  const {
    name, email, password, nis, nisn,
    majorId, classId, enrollYear,
    birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, previousSchool,
    studentStatus, studentNotes,
    bukuIndukData,
  } = body;

  if (!name || !email || !password || !nis || !majorId) {
    return NextResponse.json(
      { error: "Nama, email, password, NIS, dan jurusan wajib diisi" },
      { status: 400 }
    );
  }

  // Cek email sudah ada
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
  }

  // Cek NIS sudah ada
  const existingNis = await prisma.student.findUnique({ where: { nis } });
  if (existingNis) {
    return NextResponse.json({ error: "NIS sudah digunakan" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "STUDENT",
    },
  });

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      nis,
      nisn: nisn || null,
      majorId,
      classId: classId || null,
      enrollYear: enrollYear ? parseInt(String(enrollYear)) : null,
      birthPlace: birthPlace || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
      religion: religion || null,
      address: address || null,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
      parentJob: parentJob || null,
      previousSchool: previousSchool || null,
      studentStatus: studentStatus || "AKTIF",
      studentNotes: studentNotes || null,
      bukuIndukData: bukuIndukData || undefined,
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
  });

  return NextResponse.json(student, { status: 201 });
}
