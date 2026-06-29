import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") || undefined;
  const semester = searchParams.get("semester") || undefined;

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: { homeroomOf: { select: { id: true, name: true } } },
  });

  if (!teacher) {
    return new Response("Unauthorized", { status: 403 });
  }

  // Scope to teacher's homeroom classes, or all if classId specified & valid
  const allowedClassIds = teacher.homeroomOf.map(c => c.id);
  const effectiveClassId = classId && allowedClassIds.includes(classId) ? classId : undefined;
  const queryClassIds = effectiveClassId ? [effectiveClassId] : allowedClassIds;

  const grades = await prisma.grade.findMany({
    where: {
      teacherId: teacher.id,
      ...(queryClassIds.length > 0 ? { student: { classId: { in: queryClassIds } } } : {}),
      ...(semester ? { semester } : {}),
    },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          class: { select: { name: true, grade: true } },
        },
      },
    },
    orderBy: [
      { student: { class: { grade: "asc" } } },
      { student: { class: { name: "asc" } } },
      { student: { nis: "asc" } },
      { semester: "asc" },
      { subject: "asc" },
      { type: "asc" },
    ],
  });

  const BOM = "﻿";
  const headers = ["No", "NIS", "Nama Siswa", "Kelas", "Semester", "Mata Pelajaran", "Tipe Nilai", "Nilai"];

  const rows = grades.map((g, i) => [
    i + 1,
    g.student.nis,
    g.student.user.name,
    g.student.class?.name ?? "",
    g.semester,
    g.subject,
    g.type,
    g.score,
  ]);

  const csv = BOM + [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const slug = semester ? semester.replace(/\s+/g, "-").toLowerCase() : "semua";
  const filename = `nilai-${slug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
