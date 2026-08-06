import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: {
        internship: {
          include: { journal: { orderBy: { date: "desc" } } },
        },
      },
    });
    return Response.json({ internship: student?.internship ?? null });
  } catch {
    return Response.json({ error: "Gagal memuat data PKL" }, { status: 500 });
  }
}
