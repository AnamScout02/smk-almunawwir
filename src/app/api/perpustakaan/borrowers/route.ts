import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const [classes, students, teachers, staff] = await Promise.all([
      prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.student.findMany({
        where: { studentStatus: "AKTIF" },
        select: { userId: true, nis: true, user: { select: { name: true } }, class: { select: { id: true, name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.teacher.findMany({
        select: { userId: true, nip: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.user.findMany({
        where: { role: { in: ["TAS", "ADMIN"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      classes,
      students: students.map(s => ({ id: s.userId, identifier: s.nis, name: s.user.name, classId: s.class?.id ?? null, className: s.class?.name ?? "—" })),
      teachers: teachers.map(t => ({ id: t.userId, identifier: t.nip, name: t.user.name })),
      staff: staff.map(u => ({ id: u.id, identifier: "-", name: u.name })),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
