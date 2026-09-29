import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: {
        id: true, nis: true, nisn: true,
        birthPlace: true, birthDate: true, gender: true, religion: true, address: true,
        parentName: true, parentPhone: true, parentJob: true, previousSchool: true,
        bukuIndukData: true,
        class: { select: { name: true } },
        major: { select: { name: true } },
        profileEditRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!student) return Response.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });

    const history = await prisma.profileEditRequest.findMany({
      where: { studentId: student.id, status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true, changes: true },
    });

    return Response.json({ ...student, history });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat biodata" }, { status: 500 });
  }
}
