import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const majors = await prisma.major.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } });
  return Response.json(majors);
}
