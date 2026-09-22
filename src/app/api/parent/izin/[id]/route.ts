import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect } from "@/lib/parent-guard";

export const dynamic = "force-dynamic";

/** Orang tua membatalkan pengajuan yang BELUM diputuskan wali kelas. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { id } = await params;
  const anak = await getParentChildrenOrRedirect(session);
  const izin = await prisma.izinSiswa.findUnique({ where: { id }, select: { studentId: true, status: true } });
  if (!izin || !anak.some(a => a.id === izin.studentId)) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (izin.status !== "MENUNGGU") return Response.json({ error: "Pengajuan yang sudah diputuskan tidak bisa dibatalkan." }, { status: 409 });
  await prisma.izinSiswa.update({ where: { id }, data: { status: "DIBATALKAN" } });
  return Response.json({ ok: true });
}
