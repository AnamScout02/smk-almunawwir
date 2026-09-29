import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

// PERBAIKAN KRITIS 2026-08-10 (temuan user) — lihat komentar sama di ../route.ts.
async function assertCanManageCategories(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  const names = await getJabatanNames(session.email);
  if (session.role === "TAS" && names.some(n => TAS_JABATAN.includes(n))) return;
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
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Koordinator Ekstrakurikuler." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menghapus ekstrakurikuler." }, { status: 500 });
  }
}
