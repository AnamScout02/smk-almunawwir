import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await verifyRole(["ADMIN"]);
  const students = await prisma.student.findMany({
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
    orderBy: [{ enrollYear: "desc" }, { user: { name: "asc" } }],
  });
  return NextResponse.json(students);
}
