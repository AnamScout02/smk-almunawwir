import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        homeroomOf: { select: { id: true, name: true } },
        jabatan: { include: { jabatan: { select: { id: true, name: true } } } },
        teachingLoad: { include: { subject: { select: { name: true } } }, distinct: ["subjectId"] },
      },
      orderBy: { user: { name: "asc" } },
    });
    const shaped = teachers.map(t => ({
      ...t,
      subject: t.teachingLoad.length ? t.teachingLoad.map(a => a.subject.name).join(", ") : t.subject,
    }));
    return Response.json(shaped);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
