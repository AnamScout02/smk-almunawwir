import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Dipakai halaman login (panel branding kiri) — angka HARUS live dari database, bukan teks
// statis/SiteSetting yang gampang basi (contoh nyata: stats.students pernah menyimpan 354
// padahal siswa aktif sungguhan di database sudah berubah jadi 315).
export async function GET() {
  const [students, teachers, majors] = await Promise.all([
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.teacher.count({ where: { teacherStatus: "AKTIF" } }).catch(() => 0),
    prisma.major.count().catch(() => 0),
  ]);
  return Response.json({ students, teachers, majors });
}
