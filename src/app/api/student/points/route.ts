import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { computeStudentPointsSummary } from "@/lib/student-points";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Poin pelanggaran/prestasi MILIK SENDIRI — read-only, sesuai Pasal 7 Tata Tertib (akumulasi
 * poin pelanggaran per tahun ajaran, dikurangi poin prestasi). Siswa cuma lihat punya sendiri,
 * tidak bisa lihat siswa lain (beda dgn /api/admin/student-points/records yg khusus BK/Kesiswaan). */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!student) return Response.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });

    const summary = await computeStudentPointsSummary(student.id);
    return Response.json(summary);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
