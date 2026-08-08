import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJournalGradeAggregates } from "@/lib/journal-grades";

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

  // Nilai dihitung dari rata-rata Jurnal Mengajar guru ini (Pengetahuan/Keterampilan per
  // pertemuan) — lihat src/lib/journal-grades.ts. Kalau teacherId tidak diisi di helper (mis.
  // ADMIN yg tidak py baris Teacher), tetap scope ke classId biar tidak bocor semua guru.
  const studentIds = queryClassIds.length > 0
    ? (await prisma.student.findMany({ where: { classId: { in: queryClassIds }, studentStatus: "AKTIF" }, select: { id: true } })).map(s => s.id)
    : undefined;
  const aggregates = await getJournalGradeAggregates({ teacherId: teacher.id, semester, studentIds });

  const students = await prisma.student.findMany({
    where: { id: { in: [...new Set(aggregates.map(a => a.studentId))] } },
    select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true, grade: true } } },
  });
  const studentMap = new Map(students.map(s => [s.id, s]));

  const rowsData = aggregates
    .map(a => ({ ...a, student: studentMap.get(a.studentId) }))
    .filter((a): a is typeof a & { student: NonNullable<typeof a.student> } => !!a.student)
    .sort((a, b) =>
      (a.student.class?.grade ?? 0) - (b.student.class?.grade ?? 0)
      || (a.student.class?.name ?? "").localeCompare(b.student.class?.name ?? "")
      || a.student.nis.localeCompare(b.student.nis)
      || a.semester.localeCompare(b.semester)
      || a.subject.localeCompare(b.subject)
    );

  const BOM = "﻿";
  const headers = ["No", "NIS", "Nama Siswa", "Kelas", "Semester", "Mata Pelajaran", "Nilai Pengetahuan", "Nilai Keterampilan", "Rata-rata"];

  const rows = rowsData.map((g, i) => [
    i + 1,
    g.student.nis,
    g.student.user.name,
    g.student.class?.name ?? "",
    g.semester,
    g.subject,
    g.avgPengetahuan ?? "",
    g.avgKeterampilan ?? "",
    g.avg ?? "",
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
