import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

    const where = {
      ...(action ? { action } : {}),
      ...(q ? { OR: [
        { userName: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ] } : {}),
    };

    const [logs, total, actions] = await Promise.all([
      prisma.activityLog.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    ]);

    return Response.json({ logs, total, page, pageSize: PAGE_SIZE, actions: actions.map(a => a.action) });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
