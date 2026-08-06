import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [
    `Ganjil ${prevTahunAjaran}`,
    `Genap ${prevTahunAjaran}`,
    `Ganjil ${currentTahunAjaran}`,
    `Genap ${currentTahunAjaran}`,
  ];
}

async function assertKepsekOrAdmin(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
  });
  const isKepsek = teacher?.jabatan.some(j => j.jabatan.name === "Kepala Sekolah") ?? false;
  if (!isKepsek) throw new Error("FORBIDDEN");
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertKepsekOrAdmin(session);

    const semesters = generateSemesters();
    const [classes, approvals] = await Promise.all([
      prisma.class.findMany({ select: { id: true, name: true, grade: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
      prisma.raporApproval.findMany(),
    ]);
    const approvalMap = new Map(approvals.map(a => [`${a.classId}::${a.semester}`, a]));

    const rows = classes.flatMap(cls => semesters.map(semester => {
      const approval = approvalMap.get(`${cls.id}::${semester}`);
      return {
        classId: cls.id, className: cls.name, grade: cls.grade, semester,
        approved: !!approval, approvalId: approval?.id ?? null,
        approvedBy: approval?.approvedBy ?? null, approvedAt: approval?.approvedAt ?? null,
      };
    }));

    return Response.json(rows);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertKepsekOrAdmin(session);

    const { classId, semester, note } = await req.json();
    if (!classId || !semester) {
      return Response.json({ error: "Kelas dan semester wajib diisi." }, { status: 400 });
    }

    const approval = await prisma.raporApproval.upsert({
      where: { classId_semester: { classId, semester } },
      create: { classId, semester, approvedBy: session.name, note: note || null },
      update: { approvedBy: session.name, approvedAt: new Date(), note: note || null },
    });

    return Response.json(approval);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan pengesahan." }, { status: 500 });
  }
}
