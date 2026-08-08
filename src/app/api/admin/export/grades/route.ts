import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJournalGradeAggregates } from "@/lib/journal-grades";

export async function GET(req: Request) {
  await verifyRole(["ADMIN", "TAS"]);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") || undefined;
  const semester = searchParams.get("semester") || undefined;

  // Nilai dihitung dari rata-rata Jurnal Mengajar (Pengetahuan/Keterampilan per pertemuan) —
  // lihat src/lib/journal-grades.ts.
  const aggregates = await getJournalGradeAggregates({ classId, semester });

  const students = await prisma.student.findMany({
    where: { id: { in: [...new Set(aggregates.map(a => a.studentId))] } },
    select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { id: true, name: true, grade: true } }, major: { select: { name: true, code: true } } },
  });
  const studentMap = new Map(students.map(s => [s.id, s]));

  // "Guru" per baris diambil dari Penugasan Mengajar (kelas siswa saat ini + mapel) — bukan dari
  // baris nilai (yg sekarang tidak nyimpen teacherId per baris lagi, cuma pegangan Jurnal).
  const assignments = await prisma.teachingAssignment.findMany({
    where: { classId: { in: [...new Set(students.map(s => s.class?.id).filter((v): v is string => !!v))] } },
    select: { classId: true, subject: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
  });
  const teacherByClassSubject = new Map(assignments.map(a => [`${a.classId}::${a.subject.name}`, a.teacher.user.name]));

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
  const headers = ["No", "NIS", "Nama Siswa", "Kelas", "Tingkat", "Jurusan", "Semester", "Mata Pelajaran", "Nilai Pengetahuan", "Nilai Keterampilan", "Rata-rata", "Guru"];

  const rows = rowsData.map((g, i) => [
    i + 1,
    g.student.nis,
    g.student.user.name,
    g.student.class?.name ?? "",
    g.student.class?.grade ?? "",
    g.student.major.code,
    g.semester,
    g.subject,
    g.avgPengetahuan ?? "",
    g.avgKeterampilan ?? "",
    g.avg ?? "",
    (g.student.class ? teacherByClassSubject.get(`${g.student.class.id}::${g.subject}`) : null) ?? "",
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
