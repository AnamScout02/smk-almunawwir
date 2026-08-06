import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

async function assertCanManageCategories(session: { role: string; email: string }) {
  if (session.role === "ADMIN" || session.role === "TAS") return;
  const names = await getJabatanNames(session.email);
  if (!names.includes("Koordinator Ekstrakurikuler")) throw new Error("FORBIDDEN");
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertCanManageCategories(session);

    const { id } = await params;
    await prisma.extracurricular.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Koordinator Ekstrakurikuler." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menghapus ekstrakurikuler." }, { status: 500 });
  }
}
