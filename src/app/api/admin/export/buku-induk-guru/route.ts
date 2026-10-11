import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { GURU_COLUMNS } from "@/lib/buku-induk-guru-columns";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  await verifyTasAccess();
  const status = req.nextUrl.searchParams.get("status");

  const teachers = await prisma.teacher.findMany({
    where: status ? { teacherStatus: status } : undefined,
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: { select: { name: true } },
      // Jabatan struktural & riwayat PKB ikut tampil di Buku Induk (tautan data 10 Okt 2026) — dibaca, bukan disalin.
      jabatan: { select: { jabatan: { select: { name: true } } } },
      pkb: { select: { judul: true, mulai: true, jamPelajaran: true }, orderBy: { mulai: "desc" } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const headers = ["No", ...GURU_COLUMNS.map(c => c.label)];
  const rows = teachers.map((t, i) => [
    i + 1,
    ...GURU_COLUMNS.map(c => c.get({
      ...t,
      bukuIndukData: t.bukuIndukData as Record<string, unknown> | null,
    })),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Buku Induk Guru");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="tabel-buku-induk-guru.xlsx"',
    },
  });
}
