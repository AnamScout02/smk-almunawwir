import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get("yearId");

  if (yearId) {
    // Statistik historis dari StudentClassHistory
    const histories = await prisma.studentClassHistory.findMany({
      where: { academicYearId: yearId },
    });

    const total = histories.length;
    const aktif = histories.filter((h) => h.status === "AKTIF").length;
    const lulus = histories.filter((h) => h.status === "LULUS").length;
    const keluar = histories.filter((h) => h.status === "KELUAR").length;
    const pindah = histories.filter((h) => h.status === "PINDAH").length;

    // Per grade
    const gradeMap = new Map<number, number>();
    for (const h of histories) {
      if (h.grade !== null && h.grade !== undefined) {
        gradeMap.set(h.grade, (gradeMap.get(h.grade) ?? 0) + 1);
      }
    }
    const perGrade = Array.from(gradeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([grade, count]) => ({ grade, count }));

    // Per major
    const majorMap = new Map<string, number>();
    for (const h of histories) {
      if (h.majorName) {
        majorMap.set(h.majorName, (majorMap.get(h.majorName) ?? 0) + 1);
      }
    }
    const perMajor = Array.from(majorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({ total, aktif, lulus, keluar, pindah, perGrade, perMajor });
  }

  // Statistik live dari tabel Student (tahun berjalan)
  const students = await prisma.student.findMany({
    include: {
      class: { select: { grade: true } },
      major: { select: { name: true } },
    },
  });

  const total = students.length;
  const aktif = students.filter((s) => s.studentStatus === "AKTIF").length;
  const lulus = students.filter((s) => s.studentStatus === "LULUS").length;
  const keluar = students.filter((s) => s.studentStatus === "KELUAR").length;
  const pindah = students.filter((s) => s.studentStatus === "PINDAH").length;

  const gradeMap = new Map<number, number>();
  for (const s of students) {
    if (s.class?.grade !== undefined && s.class?.grade !== null) {
      gradeMap.set(s.class.grade, (gradeMap.get(s.class.grade) ?? 0) + 1);
    }
  }
  const perGrade = Array.from(gradeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([grade, count]) => ({ grade, count }));

  const majorMap = new Map<string, number>();
  for (const s of students) {
    if (s.major?.name) {
      majorMap.set(s.major.name, (majorMap.get(s.major.name) ?? 0) + 1);
    }
  }
  const perMajor = Array.from(majorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({ total, aktif, lulus, keluar, pindah, perGrade, perMajor });
}
