import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return NextResponse.json(teachers);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);

  const body = await req.json();
  const {
    name, email, password, nip, subject, phone,
    birthPlace, birthDate, gender, religion, address,
    education, position, startDate,
    teacherStatus, teacherNotes,
    bukuIndukData,
  } = body;

  if (!name || !email || !password || !nip || !subject) {
    return NextResponse.json(
      { error: "Nama, email, password, NIP, dan mata pelajaran wajib diisi" },
      { status: 400 }
    );
  }

  // Cek email sudah ada
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
  }

  // Cek NIP sudah ada
  const existingNip = await prisma.teacher.findUnique({ where: { nip } });
  if (existingNip) {
    return NextResponse.json({ error: "NIP sudah digunakan" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "TEACHER",
    },
  });

  const teacher = await prisma.teacher.create({
    data: {
      userId: user.id,
      nip,
      subject,
      phone: phone || null,
      birthPlace: birthPlace || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
      religion: religion || null,
      address: address || null,
      education: education || null,
      position: position || null,
      startDate: startDate ? new Date(startDate) : null,
      teacherStatus: teacherStatus || "AKTIF",
      teacherNotes: teacherNotes || null,
      bukuIndukData: bukuIndukData || undefined,
    },
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: { select: { name: true } },
    },
  });

  return NextResponse.json(teacher, { status: 201 });
}
