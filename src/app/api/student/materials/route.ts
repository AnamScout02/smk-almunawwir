import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { classId: true } });
    if (!student?.classId) return Response.json([]);

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");

    const materials = await prisma.material.findMany({
      where: { classId: student.classId, ...(subject ? { subject } : {}) },
      include: { teacher: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(materials);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
