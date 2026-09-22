import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { guruSaya, kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

/** Hapus satu catatan PKB — pemiliknya sendiri atau pengelola kepegawaian. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const [kelola, saya, baris] = await Promise.all([
    kelolaKepegawaian(session), guruSaya(session.userId),
    prisma.pkbGuru.findUnique({ where: { id }, select: { teacherId: true } }),
  ]);
  if (!baris) return Response.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
  if (!kelola && baris.teacherId !== saya?.id) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.pkbGuru.delete({ where: { id } });
  return Response.json({ ok: true });
}
