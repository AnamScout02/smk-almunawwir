import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Riwayat aktivitas KHUSUS modul Bendahara (entity="Invoice") — endpoint terpisah dari
 * `/api/admin/activity-log` (yang ADMIN-only & tampilkan SEMUA log sistem termasuk yang sensitif
 * di luar urusan tagihan, mis. DELETE_USER). Staf Bendahara cuma boleh lihat riwayat aksi tagihan
 * mereka sendiri, bukan seluruh log sistem. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

    const where = {
      entity: "Invoice",
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
      prisma.activityLog.findMany({ where: { entity: "Invoice" }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    ]);

    return Response.json({ logs, total, page, pageSize: PAGE_SIZE, actions: actions.map(a => a.action) });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
