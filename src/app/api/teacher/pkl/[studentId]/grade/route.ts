import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { bagianWib } from "@/lib/waktu-wib";

function currentSemester(): string {
  const now = new Date();
  const { tahun: year, bulan: month } = bagianWib(now); // WIB, bukan jam server (UTC)
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { studentId } = await params;
    const { score } = await req.json();

    if (typeof score !== "number" || score < 0 || score > 100) {
      return Response.json({ error: "Nilai harus angka 0-100." }, { status: 400 });
    }

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const internship = await prisma.internship.findUnique({ where: { studentId }, select: { teacherId: true } });
    if (!internship || internship.teacherId !== teacher.id) {
      return Response.json({ error: "Bukan siswa bimbingan Anda." }, { status: 403 });
    }

    const semester = currentSemester();

    await prisma.$transaction(async (tx) => {
      await tx.grade.deleteMany({ where: { studentId, teacherId: teacher.id, subject: "PKL", type: "Nilai PKL", semester } });
      await tx.grade.create({ data: { studentId, teacherId: teacher.id, subject: "PKL", type: "Nilai PKL", semester, score } });
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menyimpan nilai." }, { status: 500 });
  }
}
