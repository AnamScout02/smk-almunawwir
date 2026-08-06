import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      include: {
        user: { select: { name: true, email: true } },
        class: { select: { name: true, grade: true } },
        major: { select: { name: true, code: true } },
        internship: { include: { teacher: { include: { user: { select: { name: true } } } } } },
      },
      orderBy: [{ class: { grade: "asc" } }, { user: { name: "asc" } }],
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
