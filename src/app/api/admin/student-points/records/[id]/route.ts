import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";

/** Hapus catatan poin (koreksi kalau salah input) — khusus Admin/Wakasek Kesiswaan/Guru BK,
 * TERMASUK utk catatan yg tadinya diinput guru piket. Guru piket sendiri TIDAK bisa hapus
 * (bahkan punya sendiri) — kalau salah input, minta BK/Kesiswaan yg koreksi. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { id } = await params;
    await prisma.studentPointRecord.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus catatan" }, { status: 500 });
  }
}
