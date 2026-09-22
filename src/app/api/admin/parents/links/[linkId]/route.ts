import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

/** Putuskan hubungan SATU akun Orang Tua dari SATU anak (mis. salah sambung — nomor HP bekas
 * orang lain ke-link ke siswa yang salah). Tidak menghapus akun Orang Tua itu sendiri — kalau
 * itu anak satu-satunya, akun jadi tanpa anak dan otomatis ter-redirect ke /login saat login
 * (lihat getParentChildrenOrRedirect) sampai admin hubungkan ulang / hapus manual dari model User. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const session = await verifyRole(["ADMIN"]);
  const { linkId } = await params;

  const link = await prisma.parentStudent.findUnique({
    where: { id: linkId },
    include: { parent: { include: { user: { select: { name: true } } } }, student: { include: { user: { select: { name: true } } } } },
  });
  if (!link) return Response.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.parentStudent.delete({ where: { id: linkId } });

  await logActivity(session, {
    action: "UNLINK_PARENT_STUDENT", entity: "ParentStudent", entityId: linkId,
    description: `${session.name} memutus hubungan akun Orang Tua "${link.parent.user.name}" dari siswa "${link.student.user.name}"`,
  });

  return Response.json({ success: true });
}
