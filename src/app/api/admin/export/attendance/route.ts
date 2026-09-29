import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { balasanExcel } from "@/lib/ekspor-excel";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();

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

    return balasanExcel({
      namaFile: month ? `absensi-${month}` : `absensi-${new Date().toISOString().slice(0, 10)}`,
      namaSheet: "Absensi Siswa",
      headers, rows,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
