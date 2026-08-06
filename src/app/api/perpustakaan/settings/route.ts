import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const settings = await getSettings(["perpustakaan.dendaPerHari"]);
    return NextResponse.json({ dendaPerHari: Number(settings["perpustakaan.dendaPerHari"] ?? 0) });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const body = await req.json();
    const dendaPerHari = Number(body.dendaPerHari);
    if (isNaN(dendaPerHari) || dendaPerHari < 0) {
      return NextResponse.json({ error: "Nilai denda tidak valid" }, { status: 400 });
    }

    await prisma.siteSetting.upsert({
      where: { key: "perpustakaan.dendaPerHari" },
      update: { value: String(dendaPerHari) },
      create: { key: "perpustakaan.dendaPerHari", value: String(dendaPerHari) },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
