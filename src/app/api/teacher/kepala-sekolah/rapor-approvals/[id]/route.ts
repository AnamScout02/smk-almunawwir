import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

async function assertKepsekOrAdmin(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
  });
  const isKepsek = teacher?.jabatan.some(j => j.jabatan.name === "Kepala Sekolah") ?? false;
  if (!isKepsek) throw new Error("FORBIDDEN");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertKepsekOrAdmin(session);
    const { id } = await params;
    await prisma.raporApproval.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Gagal membatalkan pengesahan." }, { status: 500 });
  }
}
