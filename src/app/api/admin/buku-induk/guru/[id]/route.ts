import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { normalizeBukuIndukText } from "@/lib/text";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyTasAccess();
  const { id } = await params;
  const body = await req.json();
  const {
    birthPlace, birthDate, gender, religion, address,
    education, position, startDate, teacherStatus, teacherNotes, phone,
    bukuIndukData, password,
  } = body;

  try {
    // Jika ada password baru, update password user
    if (password && typeof password === "string" && password.trim().length >= 1) {
      const hashed = await bcrypt.hash(password, 12);
      const teacherRef = await prisma.teacher.findUnique({ where: { id }, select: { userId: true, user: { select: { name: true, email: true } } } });
      if (teacherRef) {
        await prisma.user.update({ where: { id: teacherRef.userId }, data: { password: hashed } });
        await logActivity(session, {
          action: "RESET_PASSWORD", entity: "Teacher", entityId: id,
          description: `${session.name} mereset password guru/pegawai "${teacherRef.user.name}" (${teacherRef.user.email})`,
        });
      }
    }

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
        ...(bukuIndukData !== undefined ? { bukuIndukData: normalizeBukuIndukText(bukuIndukData) } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        homeroomOf: { select: { name: true } },
      },
    });
    return NextResponse.json(teacher);
  } catch (err) {
    console.error("[buku-induk guru PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan guru" }, { status: 500 });
  }
}
