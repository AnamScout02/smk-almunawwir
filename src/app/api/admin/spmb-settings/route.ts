import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const settings = await getSettings(["spmb.bobotRapor", "spmb.bobotTes"]);
    return NextResponse.json({
      bobotRapor: Number(settings["spmb.bobotRapor"] || "60"),
      bobotTes: Number(settings["spmb.bobotTes"] || "40"),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { bobotRapor, bobotTes } = await req.json();

    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: "spmb.bobotRapor" },
        update: { value: String(bobotRapor) },
        create: { key: "spmb.bobotRapor", value: String(bobotRapor) },
      }),
      prisma.siteSetting.upsert({
        where: { key: "spmb.bobotTes" },
        update: { value: String(bobotTes) },
        create: { key: "spmb.bobotTes", value: String(bobotTes) },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
