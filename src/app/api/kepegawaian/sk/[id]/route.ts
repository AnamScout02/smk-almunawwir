import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaKepegawaian(session))) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const { id } = await params;
  await prisma.arsipSk.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
