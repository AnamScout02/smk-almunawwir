import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Koordinator BKK", "Wakil Kepala Humas"]);

    const alumni = await prisma.student.findMany({
      where: { studentStatus: "LULUS" },
      select: {
        id: true, nis: true, enrollYear: true,
        user: { select: { name: true } },
        major: { select: { name: true, code: true } },
        alumniTracer: true,
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json(alumni);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator BKK." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
