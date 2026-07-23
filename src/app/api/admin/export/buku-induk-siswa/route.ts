import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { SISWA_COLUMNS } from "@/lib/buku-induk-siswa-columns";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const classId = req.nextUrl.searchParams.get("classId");
  const enrollYear = req.nextUrl.searchParams.get("enrollYear");

  const students = await prisma.student.findMany({
    where: {
      ...(classId ? { classId } : {}),
      ...(enrollYear ? { enrollYear: parseInt(enrollYear) } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
    orderBy: [{ class: { grade: "asc" } }, { user: { name: "asc" } }],
  });

  const headers = ["No", ...SISWA_COLUMNS.map(c => c.label)];
  const rows = students.map((s, i) => [
    i + 1,
    ...SISWA_COLUMNS.map(c => c.get({
      ...s,
      bukuIndukData: s.bukuIndukData as Record<string, unknown> | null,
    })),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Buku Induk Siswa");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="tabel-buku-induk-siswa.xlsx"',
    },
  });
}
