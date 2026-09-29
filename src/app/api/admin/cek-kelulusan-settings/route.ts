import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await verifyTasAccess();
    const settings = await getSettings(["kelulusan.tanggalBuka", "kelulusan.tanggalTutup"]);
    return NextResponse.json({
      tanggalBuka: settings["kelulusan.tanggalBuka"] || "",
      tanggalTutup: settings["kelulusan.tanggalTutup"] || "",
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { tanggalBuka, tanggalTutup } = await req.json();

    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: "kelulusan.tanggalBuka" },
        update: { value: tanggalBuka || "" },
        create: { key: "kelulusan.tanggalBuka", value: tanggalBuka || "" },
      }),
      prisma.siteSetting.upsert({
        where: { key: "kelulusan.tanggalTutup" },
        update: { value: tanggalTutup || "" },
        create: { key: "kelulusan.tanggalTutup", value: tanggalTutup || "" },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
