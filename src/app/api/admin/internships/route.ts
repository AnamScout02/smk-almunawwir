import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        class: { select: { name: true, grade: true } },
        major: { select: { name: true, code: true } },
        internship: true,
      },
      orderBy: [{ class: { grade: "asc" } }, { user: { name: "asc" } }],
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
