import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);

    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        class: { select: { name: true, grade: true } },
        major: { select: { name: true, code: true } },
      },
      orderBy: [{ class: { grade: "asc" } }, { user: { name: "asc" } }],
    });

    const headers = ["No", "NIS", "NISN", "Nama Siswa", "Email", "Kelas", "Tingkat", "Jurusan", "Kode Jurusan"];

    const rows = students.map((s, i) => [
      i + 1,
      s.nis,
      s.nisn ?? "",
      s.user.name,
      s.user.email,
      s.class?.name ?? "—",
      s.class?.grade ?? "—",
      s.major.name,
      s.major.code,
    ]);

    const escape = (v: string | number) => {
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [headers, ...rows]
      .map(row => row.map(escape).join(","))
      .join("\n");

    const bom = "﻿";
    return new Response(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="data-siswa-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
