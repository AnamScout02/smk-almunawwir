import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

async function getHomeroomClassIds(email: string): Promise<string[]> {
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email } },
    include: { homeroomOf: { select: { id: true } } },
  });
  return teacher?.homeroomOf.map(c => c.id) ?? [];
}

/** Guru mapel (bukan wali kelas) boleh input nilai HANYA untuk mapel yang benar-benar
 * diampunya di kelas tsb (sesuai Penugasan Mengajar) — bukan bebas mapel apapun. */
async function isAssignedSubject(email: string, classId: string, subject: string): Promise<boolean> {
  const assignment = await prisma.teachingAssignment.findFirst({
    where: {
      classId,
      subject: { name: subject },
      teacher: { user: { email } },
    },
  });
  return !!assignment;
}

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
    if (!teacher) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    if (session.role === "TEACHER" && classId) {
      const homeroomIds = await getHomeroomClassIds(session.email);
      if (!homeroomIds.includes(classId)) {
        const hasAssignment = await prisma.teachingAssignment.count({ where: { classId, teacherId: teacher.id } });
        if (hasAssignment === 0) return Response.json({ error: "Anda tidak memiliki akses ke kelas ini" }, { status: 403 });
      }
    }

    const grades = await prisma.grade.findMany({
      where: { teacherId: teacher.id, ...(classId ? { student: { classId } } : {}) },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(grades);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { grades } = await req.json();

    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
    if (!teacher) return Response.json({ error: "Data guru tidak ditemukan" }, { status: 404 });

    type GradeInput = { studentId: string; subject: string; type: string; semester: string; score: number };
    const list = grades as GradeInput[];

    if (session.role === "TEACHER" && list.length > 0) {
      const homeroomIds = await getHomeroomClassIds(session.email);
      const studentIds = [...new Set(list.map(g => g.studentId))];
      const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, classId: true } });
      const classById = new Map(students.map(s => [s.id, s.classId]));

      if (students.length !== studentIds.length) {
        return Response.json({ error: "Sebagian siswa tidak ditemukan" }, { status: 400 });
      }

      const subjectsToCheck = new Set<string>();
      for (const g of list) {
        const classId = classById.get(g.studentId);
        if (classId && homeroomIds.includes(classId)) continue; // wali kelas bebas mapel apapun di kelasnya
        subjectsToCheck.add(`${classId}::${g.subject}`);
      }
      for (const key of subjectsToCheck) {
        const [classId, subject] = key.split("::");
        if (!(await isAssignedSubject(session.email, classId, subject))) {
          return Response.json({ error: `Anda tidak mengajar mapel "${subject}" di kelas ini.` }, { status: 403 });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const g of list) {
        await tx.grade.deleteMany({
          where: {
            studentId: g.studentId,
            teacherId: teacher.id,
            subject: g.subject,
            type: g.type,
            semester: g.semester,
          },
        });
        await tx.grade.create({
          data: {
            studentId: g.studentId,
            teacherId: teacher.id,
            subject: g.subject,
            type: g.type,
            semester: g.semester,
            score: g.score,
          },
        });
      }
    });

    return Response.json({ count: list.length }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan nilai" }, { status: 500 });
  }
}
