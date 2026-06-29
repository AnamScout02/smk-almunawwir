import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return NextResponse.json(teachers);
}
