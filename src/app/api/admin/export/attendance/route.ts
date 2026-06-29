import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await verifyRole(["ADMIN", "TAS"]);

    const classId = req.nextUrl.searchParams.get("classId");
    const month = req.nextUrl.searchParams.get("month"); // format: "2025-06"

    const where: Record<string, unknown> = {};
    if (classId) where.student = { classId };
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.date = { gte: start, lt: end };
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            class: { select: { name: true, grade: true } },
            major: { select: { code: true } },
          },
        },
      },
      orderBy: [{ date: "asc" }, { student: { user: { name: "asc" } } }],
    });

    const headers = ["No", "Tanggal", "Nama Siswa", "Kelas", "Tingkat", "Jurusan", "Status"];

    const rows = records.map((r, i) => [
      i + 1,
      new Date(r.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      r.student.user.name,
      r.student.class?.name ?? "—",
      r.student.class?.grade ?? "—",
      r.student.major.code,
      r.status,
    ]);

    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\n");
    const bom = "﻿";
    const filename = month
      ? `absensi-${month}.csv`
      : `absensi-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
