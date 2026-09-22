import { prisma } from "@/lib/prisma";
import { balasanExcel } from "@/lib/ekspor-excel";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  await verifyTasAccess();

  const students = await prisma.student.findMany({
    where: { studentStatus: "AKTIF" },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
      internship: true,
    },
    orderBy: [
      { class: { grade: "asc" } },
      { class: { name: "asc" } },
      { nis: "asc" },
    ],
  });

  const headers = [
    "No", "NIS", "Nama Siswa", "Kelas", "Tingkat", "Jurusan",
    "Status PKL", "Perusahaan", "Posisi", "Supervisor",
    "Tanggal Mulai", "Tanggal Selesai",
  ];

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

  const rows = students.map((s, i) => [
    i + 1,
    s.nis,
    s.user.name,
    s.class?.name ?? "",
    s.class?.grade ?? "",
    s.major.code,
    s.internship ? s.internship.status : "BELUM_PKL",
    s.internship?.company ?? "",
    s.internship?.position ?? "",
    s.internship?.supervisor ?? "",
    fmt(s.internship?.startDate),
    fmt(s.internship?.endDate),
  ]);

  return balasanExcel({ namaFile: "data-pkl", namaSheet: "Data PKL", headers, rows });
}
