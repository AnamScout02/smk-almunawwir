import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") || undefined;
  const month = searchParams.get("month") || undefined; // format: "2025-06"

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: { homeroomOf: { select: { id: true, name: true } } },
  });

  if (!teacher) return new Response("Unauthorized", { status: 403 });

  const allowedClassIds = teacher.homeroomOf.map(c => c.id);
  const effectiveClassId = classId && allowedClassIds.includes(classId) ? classId : undefined;
  const queryClassIds = effectiveClassId ? [effectiveClassId] : allowedClassIds;

  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateFilter = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }

  const records = await prisma.attendance.findMany({
    where: {
      ...(queryClassIds.length > 0 ? { student: { classId: { in: queryClassIds } } } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { student: { nis: "asc" } }],
  });

  const BOM = "﻿";
  const headers = ["No", "Tanggal", "NIS", "Nama Siswa", "Kelas", "Status"];

  const rows = records.map((r, i) => [
    i + 1,
    new Date(r.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
    r.student.nis,
    r.student.user.name,
    r.student.class?.name ?? "",
    r.status,
  ]);

  const csv = BOM + [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const slug = month ?? "semua";
  const filename = `absensi-${slug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
