import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") {
      const owned = await getOwnedExtracurricularNames(session.email);
      if (owned.length === 0) return NextResponse.json({ error: "Khusus Pembina Ekstrakurikuler." }, { status: 403 });
    }

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json(students.map(s => ({ id: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—" })));
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
