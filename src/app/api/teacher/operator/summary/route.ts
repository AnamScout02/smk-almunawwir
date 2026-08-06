import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Operator Sekolah"]);

    const [
      noGenderStudents, noGenderTeachers, unclassedStudents, noNisnStudents,
      pendingAdmissions, pendingProfileEdits,
    ] = await Promise.all([
      prisma.student.count({ where: { studentStatus: "AKTIF", gender: null } }),
      prisma.teacher.count({ where: { gender: null } }),
      prisma.student.count({ where: { studentStatus: "AKTIF", classId: null } }),
      prisma.student.count({ where: { studentStatus: "AKTIF", nisn: null } }),
      prisma.admission.count({ where: { status: "PENDING" } }),
      prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
    ]);

    const checklist = [
      { label: "Siswa belum ada Jenis Kelamin", count: noGenderStudents, href: "/dashboard/admin/buku-induk/siswa" },
      { label: "Guru belum ada Jenis Kelamin", count: noGenderTeachers, href: "/dashboard/admin/buku-induk/guru" },
      { label: "Siswa belum punya Kelas", count: unclassedStudents, href: "/dashboard/admin/buku-induk/siswa" },
      { label: "Siswa belum ada NISN", count: noNisnStudents, href: "/dashboard/admin/buku-induk/siswa" },
      { label: "Pendaftaran (PPDB) menunggu diproses", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
      { label: "Pengajuan perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    ].filter(c => c.count > 0);

    return Response.json({
      totalItems: checklist.reduce((a, c) => a + c.count, 0),
      checklist,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Operator Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
