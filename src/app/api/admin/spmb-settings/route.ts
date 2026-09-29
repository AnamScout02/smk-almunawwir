import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await verifyTasAccess();
    const settings = await getSettings(["spmb.bobotRapor", "spmb.bobotTes"]);
    return NextResponse.json({
      bobotRapor: Number(settings["spmb.bobotRapor"] || "60"),
      bobotTes: Number(settings["spmb.bobotTes"] || "40"),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyTasAccess();
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
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
