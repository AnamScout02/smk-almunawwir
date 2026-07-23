import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;
  const body = await req.json();
  const { day, startTime, hours, weekType } = body;
  if (!day || !startTime || !hours || Number(hours) < 1) {
    return NextResponse.json({ error: "Hari, jam mulai, dan jumlah jam wajib diisi" }, { status: 400 });
  }
  const item = await prisma.teachingPreference.create({
    data: { teachingAssignmentId: id, day, startTime, hours: parseInt(String(hours)), weekType: weekType || "SEMUA" },
  });
  return NextResponse.json(item, { status: 201 });
}
