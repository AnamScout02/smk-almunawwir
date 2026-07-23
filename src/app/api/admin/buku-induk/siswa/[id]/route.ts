import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const {
    nisn, birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, previousSchool, enrollYear,
    studentStatus, exitDate, studentNotes,
    bukuIndukData, password,
  } = body;

  try {
    // Jika ada password baru, update password user
    if (password && typeof password === "string" && password.trim().length >= 1) {
      const hashed = await bcrypt.hash(password, 12);
      const studentRef = await prisma.student.findUnique({ where: { id }, select: { userId: true } });
      if (studentRef) {
        await prisma.user.update({ where: { id: studentRef.userId }, data: { password: hashed } });
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
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
  } catch (err) {
    console.error("[buku-induk siswa PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan siswa" }, { status: 500 });
  }
}
