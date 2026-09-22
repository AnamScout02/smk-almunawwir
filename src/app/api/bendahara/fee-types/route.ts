import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const types = await prisma.feeType.findMany({ orderBy: [{ order: "asc" }] });
    return Response.json(types);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal memuat jenis biaya" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { name, defaultAmount } = await req.json();
    if (!name?.trim() || typeof defaultAmount !== "number" || defaultAmount < 0) {
      return Response.json({ error: "Nama dan jumlah default wajib diisi dengan benar" }, { status: 400 });
    }
    const max = await prisma.feeType.aggregate({ _max: { order: true } });
    const type = await prisma.feeType.create({
      data: { name: name.trim(), defaultAmount, order: (max._max.order ?? 0) + 1 },
    });
    return Response.json(type, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menambah jenis biaya" }, { status: 500 });
  }
}
