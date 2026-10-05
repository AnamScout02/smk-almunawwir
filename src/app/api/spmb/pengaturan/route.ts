import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { KUNCI_FORM_SPMB, KUNCI_KONTEN_SPMB } from "@/lib/spmb-konten";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const DIIZINKAN = new Set<string>([
  ...KUNCI_KONTEN_SPMB, "spmb.bobotRapor", "spmb.bobotTes", ...KUNCI_FORM_SPMB,
]);

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    return NextResponse.json(await getSettings([...DIIZINKAN]));
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const body = await req.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Isian tidak sah" }, { status: 400 });

    // Hanya kunci yang didaftarkan boleh ditulis — tanpa saringan ini route ini menjadi pintu
    // untuk menimpa SiteSetting apa pun (mis. kunci Dapodik) dari satu halaman panitia SPMB.
    const masuk = Object.entries(body).filter(([k]) => DIIZINKAN.has(k));
    if (!masuk.length) return NextResponse.json({ error: "Tidak ada isian yang dikenali" }, { status: 400 });

    await prisma.$transaction(masuk.map(([key, value]) => {
      const v = typeof value === "string" ? value : JSON.stringify(value ?? "");
      return prisma.siteSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
    }));
    await logActivity(session, {
      action: "UPDATE", entity: "SpmbPengaturan",
      description: `Mengubah ${masuk.length} isian SPMB (${masuk.map(([k]) => k.replace("spmb.", "")).join(", ")})`,
    });
    return NextResponse.json({ ok: true, tersimpan: masuk.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
