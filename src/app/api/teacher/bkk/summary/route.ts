import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Koordinator BKK"]);

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF", class: { grade: 12 } },
      select: {
        id: true, nis: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        internship: { select: { company: true, position: true, status: true } },
      },
    });

    const placed = students.filter(s => s.internship);
    const unplaced = students.filter(s => !s.internship);

    const statusCount = { ONGOING: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const s of placed) {
      const st = s.internship!.status;
      if (st in statusCount) statusCount[st as keyof typeof statusCount]++;
    }

    const byCompany = new Map<string, number>();
    for (const s of placed) {
      const company = s.internship!.company;
      byCompany.set(company, (byCompany.get(company) ?? 0) + 1);
    }
    const topCompanies = Array.from(byCompany.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const unplacedList = unplaced.map(s => ({
      studentId: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—",
    }));

    return Response.json({
      totalTwelve: students.length, placedCount: placed.length, unplacedCount: unplaced.length,
      statusCount, topCompanies, unplacedList,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Koordinator BKK." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
