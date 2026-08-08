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

    const settings = await getSettings(["perpustakaan.dendaPerHari", "perpustakaan.masaPeminjamanHari"]);
    return NextResponse.json({
      dendaPerHari: Number(settings["perpustakaan.dendaPerHari"] ?? 0),
      masaPeminjamanHari: Number(settings["perpustakaan.masaPeminjamanHari"] ?? 7),
    });
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
    const updates: { key: string; value: string }[] = [];

    if (body.dendaPerHari !== undefined) {
      const dendaPerHari = Number(body.dendaPerHari);
      if (isNaN(dendaPerHari) || dendaPerHari < 0) {
        return NextResponse.json({ error: "Nilai denda tidak valid" }, { status: 400 });
      }
      updates.push({ key: "perpustakaan.dendaPerHari", value: String(dendaPerHari) });
    }
    if (body.masaPeminjamanHari !== undefined) {
      const masaPeminjamanHari = Number(body.masaPeminjamanHari);
      if (isNaN(masaPeminjamanHari) || masaPeminjamanHari < 1) {
        return NextResponse.json({ error: "Masa peminjaman minimal 1 hari" }, { status: 400 });
      }
      updates.push({ key: "perpustakaan.masaPeminjamanHari", value: String(masaPeminjamanHari) });
    }

    await Promise.all(updates.map(u => prisma.siteSetting.upsert({
      where: { key: u.key },
      update: { value: u.value },
      create: { key: u.key, value: u.value },
    })));

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
