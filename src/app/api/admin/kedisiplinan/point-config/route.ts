import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { prisma } from "@/lib/prisma";
import { getDisciplinePointConfig } from "@/lib/discipline-points";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

// Mengubah bobot poin sekolah SENGAJA dibatasi lebih ketat daripada assertKedisiplinan biasa
// (yang juga meloloskan guru piket harian) — cukup ADMIN atau dua Wakasek pemilik modul ini.
async function assertPointConfigAccess(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  await assertJabatan(session, ["Wakil Kepala Bidang Penjamin Mutu", "Wakil Kepala Kurikulum"]);
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertPointConfigAccess(session);
    const config = await getDisciplinePointConfig();
    return NextResponse.json(config);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertPointConfigAccess(session);

    const body = await req.json();
    const {
      pointHadir, pointTerlambat, pointIzinAdaTugas, pointIzinTanpaTugas,
      pointSakitAdaTugas, pointSakitTanpaTugas, pointAlpha,
    } = body;
    const values = { pointHadir, pointTerlambat, pointIzinAdaTugas, pointIzinTanpaTugas, pointSakitAdaTugas, pointSakitTanpaTugas, pointAlpha };
    for (const [key, val] of Object.entries(values)) {
      if (typeof val !== "number" || !Number.isFinite(val)) {
        return NextResponse.json({ error: `Nilai poin "${key}" tidak valid` }, { status: 400 });
      }
    }

    const existing = await prisma.disciplinePointConfig.findFirst({ select: { id: true } });
    const config = existing
      ? await prisma.disciplinePointConfig.update({ where: { id: existing.id }, data: values })
      : await prisma.disciplinePointConfig.create({ data: values });

    return NextResponse.json(config);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Kurikulum." }, { status: 403 });
    }
    console.error("[point-config PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi poin" }, { status: 500 });
  }
}
