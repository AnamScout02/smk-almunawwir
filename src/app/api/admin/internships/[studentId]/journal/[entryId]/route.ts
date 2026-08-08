import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ studentId: string; entryId: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const { entryId } = await params;
    const body = await req.json() as { teacherNote?: string };
    const entry = await prisma.internshipJournal.update({
      where: { id: entryId },
      data: { teacherNote: body.teacherNote ?? null },
    });
    return Response.json(entry);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan catatan" }, { status: 500 });
  }
}
