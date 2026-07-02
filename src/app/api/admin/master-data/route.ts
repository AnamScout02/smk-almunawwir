import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await prisma.masterData.findMany({ orderBy: { category: "asc" } });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[master-data GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
