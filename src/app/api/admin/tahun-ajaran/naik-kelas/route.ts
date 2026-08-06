import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  await verifyRole(["ADMIN"]);

  // 1. Ambil tahun ajaran aktif
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
  });

  if (!activeYear) {
    return NextResponse.json(
      { error: "Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran terlebih dahulu." },
      { status: 400 }
    );
  }

  // 2. Ambil semua siswa AKTIF beserta kelas dan jurusan
  const activeStudents = await prisma.student.findMany({
    where: { studentStatus: "AKTIF" },
    include: {
      class: {
        include: { major: true },
      },
      user: { select: { name: true } },
    },
  });

  const promoted: string[] = [];
  const graduated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  // Sekadar PERINGATAN (bukan blokir) — siswa kelas XI yang naik ke XII tapi belum py
  // PklRegistration berstatus APPROVED tetap dinaikkan seperti biasa, cuma dicatat di sini
  // supaya admin/Wakasek Humas bisa tindak lanjuti manual.
  const pklWarnings: string[] = [];
  const approvedPklStudentIds = new Set(
    (await prisma.pklRegistration.findMany({ where: { status: "APPROVED" }, select: { studentId: true } }))
      .map(r => r.studentId)
  );

  // 3. Snapshot ke StudentClassHistory dalam satu transaction
  await prisma.$transaction(
    activeStudents.map((student) =>
      prisma.studentClassHistory.upsert({
        where: {
          studentId_academicYearId: {
            studentId: student.id,
            academicYearId: activeYear.id,
          },
        },
        update: {
          classId: student.classId,
          status: student.studentStatus ?? "AKTIF",
          grade: student.class?.grade ?? null,
          majorName: student.class?.major?.name ?? null,
          className: student.class?.name ?? null,
        },
        create: {
          studentId: student.id,
          classId: student.classId,
          academicYearId: activeYear.id,
          status: student.studentStatus ?? "AKTIF",
          grade: student.class?.grade ?? null,
          majorName: student.class?.major?.name ?? null,
          className: student.class?.name ?? null,
        },
      })
    )
  );

  // 4. Proses naik kelas per siswa (di luar transaction, satu per satu)
  for (const student of activeStudents) {
    if (!student.class) {
      skipped.push(student.id);
      continue;
    }

    const grade = student.class.grade;
    const majorId = student.class.majorId;

    try {
      if (grade === 12) {
        // Luluskan siswa grade 12
        await prisma.student.update({
          where: { id: student.id },
          data: {
            studentStatus: "LULUS",
            exitDate: new Date(),
          },
        });
        graduated.push(student.id);
      } else if (grade === 11) {
        // Cari kelas grade 12 dengan majorId sama
        const nextClass = await prisma.class.findFirst({
          where: { grade: 12, majorId },
        });
        if (nextClass) {
          await prisma.student.update({
            where: { id: student.id },
            data: { classId: nextClass.id },
          });
          promoted.push(student.id);
          if (!approvedPklStudentIds.has(student.id)) {
            pklWarnings.push(student.user.name);
          }
        } else {
          errors.push(`Kelas grade 12 untuk jurusan majorId ${majorId} tidak ditemukan (siswa ${student.id})`);
        }
      } else if (grade === 10) {
        // Cari kelas grade 11 dengan majorId sama
        const nextClass = await prisma.class.findFirst({
          where: { grade: 11, majorId },
        });
        if (nextClass) {
          await prisma.student.update({
            where: { id: student.id },
            data: { classId: nextClass.id },
          });
          promoted.push(student.id);
        } else {
          errors.push(`Kelas grade 11 untuk jurusan majorId ${majorId} tidak ditemukan (siswa ${student.id})`);
        }
      } else {
        skipped.push(student.id);
      }
    } catch (err) {
      errors.push(`Error siswa ${student.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    promoted: promoted.length,
    graduated: graduated.length,
    skipped: skipped.length,
    errors,
    pklWarnings,
  });
}
