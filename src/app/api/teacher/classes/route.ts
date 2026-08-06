import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

// Kelas yang boleh diakses guru untuk Nilai/Absensi: kelas wali (bebas mapel apapun) DIGABUNG
// kelas yang diampu lewat Penugasan Mengajar (mapel guru itu saja — divalidasi lagi di endpoint
// /api/teacher/grades & /api/teacher/attendance saat submit).
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: {
        homeroomOf: {
          include: {
            major: true,
            students: { select: { id: true }, where: { studentStatus: "AKTIF" } },
          },
          orderBy: { grade: "asc" },
        },
        teachingLoad: {
          select: {
            class: {
              include: {
                major: true,
                students: { select: { id: true }, where: { studentStatus: "AKTIF" } },
              },
            },
          },
        },
      },
    });

    const byId = new Map<string, NonNullable<typeof teacher>["homeroomOf"][number]>();
    for (const c of teacher?.homeroomOf ?? []) byId.set(c.id, c);
    for (const a of teacher?.teachingLoad ?? []) if (!byId.has(a.class.id)) byId.set(a.class.id, a.class);

    const classes = [...byId.values()].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
    return Response.json(classes);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
