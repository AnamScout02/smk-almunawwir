import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

// Data administratif Nominatif Kelas XII yang TIDAK bisa dihitung dari data siswa (pejabat
// penandatangan, kode sekolah resmi Dinas, info server ujian) — lihat catatan di
// src/lib/site-settings.ts DEFAULTS. Diedit langsung di NominatifManager.tsx, bukan Konten
// Halaman (keputusan eksplisit user 2026-09-11). `nominatif.pagu` SENGAJA tidak di sini —
// terpisah per tahun ajaran, lihat /api/admin/nominatif/pagu.
const KEYS = [
  "nominatif.pengawasNama", "nominatif.pengawasNip",
  "nominatif.dinasNama", "nominatif.dinasNip", "nominatif.dinasPangkat", "nominatif.dinasWilayah",
  "nominatif.nss", "nominatif.npsn", "nominatif.kdProp", "nominatif.kdRayon", "nominatif.kdSekolah",
  "nominatif.statusAkreditasiSekolah",
  "nominatif.kecamatan", "nominatif.kabKota", "nominatif.kodePos",
  "nominatif.jumlahServerUtama", "nominatif.jumlahServerCadangan", "nominatif.tempatUjian",
] as const;

export async function GET() {
  try {
    await verifyTasAccess();
    const s = await getSettings([...KEYS]);
    return NextResponse.json(s);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyTasAccess();
    const body = await req.json();

    await prisma.$transaction(
      KEYS.filter(k => typeof body[k] === "string").map(k =>
        prisma.siteSetting.upsert({
          where: { key: k },
          update: { value: body[k] },
          create: { key: k, value: body[k] },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
