import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { avatarUrl } = await req.json();
  if (!avatarUrl) return NextResponse.json({ error: "URL avatar diperlukan" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatar: avatarUrl },
  });

  return NextResponse.json({ ok: true });
}
