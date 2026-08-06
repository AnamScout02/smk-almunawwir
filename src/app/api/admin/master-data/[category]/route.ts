import { verifyRole } from "@/lib/dal";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    await verifyTasAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category } = await params;
  const data = await prisma.masterData.findUnique({ where: { category } });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    await verifyRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { category } = await params;
    const { items, label } = await req.json();
    const data = await prisma.masterData.update({
      where: { category },
      data: { items, label },
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[master-data PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan master data" }, { status: 500 });
  }
}
