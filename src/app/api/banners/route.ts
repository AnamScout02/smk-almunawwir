import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const banners = await prisma.heroBanner.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return Response.json(banners);
  } catch {
    return Response.json([]);
  }
}
