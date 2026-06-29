import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const where = classId ? { classId } : {};
    const students = await prisma.student.findMany({
      where,
      include: { user: { select: { name: true } }, class: true, major: true },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
