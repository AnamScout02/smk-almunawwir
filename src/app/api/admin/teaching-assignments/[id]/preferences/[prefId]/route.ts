import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; prefId: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { prefId } = await params;
  await prisma.teachingPreference.delete({ where: { id: prefId } });
  return NextResponse.json({ ok: true });
}
