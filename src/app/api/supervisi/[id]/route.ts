import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bolehSupervisi } from "@/lib/supervisi";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await bolehSupervisi(session))) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const { id } = await params;
  await prisma.supervisiGuru.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
