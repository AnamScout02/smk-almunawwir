import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await verifyRole(["ADMIN"]);
  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN"]);
  const body = await req.json();
  const { title, content, targetRole, priority, active, startDate, endDate } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Judul dan isi pengumuman wajib diisi" }, { status: 400 });
  }
  const item = await prisma.announcement.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      targetRole: targetRole ?? "ALL",
      priority: priority ?? "NORMAL",
      active: active ?? true,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
