import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const students = await prisma.student.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: true,
        major: true,
      },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(students);
  } catch {
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
