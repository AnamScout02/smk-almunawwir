import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { toProperCase, toProperCaseName, normalizeBukuIndukText } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
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
  const session = await verifyTasAccess();
  const { id } = await params;
  const body = await req.json();
  const {
    name, nisn, birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, previousSchool, enrollYear,
    studentStatus, exitDate, studentNotes,
    bukuIndukData, password,
  } = body;

  try {
    // Jika ada password dan/atau nama baru, update data user terkait
    if ((password && typeof password === "string" && password.trim().length >= 1) || (name && typeof name === "string" && name.trim().length >= 1)) {
      const studentRef = await prisma.student.findUnique({ where: { id }, select: { userId: true, user: { select: { name: true, email: true } } } });
      if (studentRef) {
        const userData: { password?: string; name?: string } = {};
        if (password && typeof password === "string" && password.trim().length >= 1) {
          userData.password = await bcrypt.hash(password, 12);
        }
        if (name && typeof name === "string" && name.trim().length >= 1) {
          userData.name = toProperCaseName(name);
        }
        await prisma.user.update({ where: { id: studentRef.userId }, data: userData });

        if (userData.password) {
          await logActivity(session, {
            action: "RESET_PASSWORD", entity: "Student", entityId: id,
            description: `${session.name} mereset password siswa "${studentRef.user.name}" (${studentRef.user.email})`,
          });
        }
        if (userData.name && userData.name !== studentRef.user.name) {
          await logActivity(session, {
            action: "UPDATE_STUDENT_NAME", entity: "Student", entityId: id,
            description: `${session.name} mengubah nama siswa dari "${studentRef.user.name}" menjadi "${userData.name}"`,
            metadata: { before: studentRef.user.name, after: userData.name },
          });
        }
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
        parentName:     parentName ? toProperCaseName(parentName) : null,
        parentPhone:    parentPhone || null,
        parentJob:      parentJob || null,
        previousSchool: previousSchool ? toProperCase(previousSchool) : null,
        enrollYear:     enrollYear ? parseInt(enrollYear) : null,
        studentStatus:  studentStatus || "AKTIF",
        exitDate:       exitDate ? new Date(exitDate) : null,
        studentNotes:   studentNotes || null,
        bukuIndukData:  bukuIndukData ? normalizeBukuIndukText(bukuIndukData) : undefined,
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
