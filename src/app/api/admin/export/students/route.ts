import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    await verifyTasAccess();

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
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

    return balasanExcel({
      namaFile: `data-siswa-${new Date().toISOString().slice(0, 10)}`,
      namaSheet: "Data Siswa",
      headers, rows,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
