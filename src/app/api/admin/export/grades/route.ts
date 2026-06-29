import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  await verifyRole(["ADMIN"]);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") || undefined;
  const semester = searchParams.get("semester") || undefined;

  const grades = await prisma.grade.findMany({
    where: {
      ...(classId ? { student: { classId } } : {}),
      ...(semester ? { semester } : {}),
    },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          class: { select: { name: true, grade: true } },
          major: { select: { name: true, code: true } },
        },
      },
      teacher: { include: { user: { select: { name: true } } } },
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
  const headers = ["No", "NIS", "Nama Siswa", "Kelas", "Tingkat", "Jurusan", "Semester", "Mata Pelajaran", "Tipe Nilai", "Nilai", "Guru"];

  const rows = grades.map((g, i) => [
    i + 1,
    g.student.nis,
    g.student.user.name,
    g.student.class?.name ?? "",
    g.student.class?.grade ?? "",
    g.student.major.code,
    g.semester,
    g.subject,
    g.type,
    g.score,
    g.teacher.user.name,
  ]);

  const csv = BOM + [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const slug = semester
    ? semester.replace(/\s+/g, "-").toLowerCase()
    : "semua-semester";
  const filename = classId ? `nilai-${slug}.csv` : `nilai-${slug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
