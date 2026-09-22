import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getKelasXIIEnrollYears, computeAutoPagu } from "@/lib/nominatif-pagu";

export const dynamic = "force-dynamic";

// Pagu SEKARANG OTOMATIS (lihat src/lib/nominatif-pagu.ts) — "jumlah seluruh siswa jurusan+
// angkatan itu, termasuk yang mutasi", dihitung dari enrollYear siswa Kelas XII (keputusan
// eksplisit user 2026-09-11, MEMBALIK desain awal murni-manual). `pagu` yang tersimpan di
// SiteSetting "nominatif.pagu" (JSON: { "<AcademicYear.name>": { "<Major.code>": pagu } }) HANYA
// override manual utk kasus enrollYear data lama tidak lengkap — GET selalu sertakan
// `paguOtomatis` juga supaya UI bisa tampilkan angka hitungan sebagai default. Status Akreditasi
// jurusan (fakta administratif, jarang berubah) disimpan langsung di kolom Major.akreditasi.
// Keduanya diedit bareng di NominatifManager.tsx.

function parsePagu(json: string): Record<string, Record<string, number>> {
  try { return JSON.parse(json || "{}"); } catch { return {}; }
}

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const academicYearId = req.nextUrl.searchParams.get("academicYearId");
    if (!academicYearId) return NextResponse.json({ error: "academicYearId wajib diisi" }, { status: 400 });

    const year = await prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true, isActive: true } });
    if (!year) return NextResponse.json({ error: "Tahun ajaran tidak ditemukan" }, { status: 404 });

    const [settings, majors] = await Promise.all([
      getSettings(["nominatif.pagu"]),
      prisma.major.findMany({ select: { id: true, name: true, code: true, akreditasi: true }, orderBy: { name: "asc" } }),
    ]);
    const paguForYear = parsePagu(settings["nominatif.pagu"])[year.name] ?? {};

    const result = await Promise.all(majors.map(async (m) => {
      const enrollYears = await getKelasXIIEnrollYears(m.id, m.name, { id: academicYearId, isActive: year.isActive });
      const paguOtomatis = await computeAutoPagu(m.id, enrollYears);
      return { majorId: m.id, code: m.code, akreditasi: m.akreditasi, pagu: paguForYear[m.code] ?? null, paguOtomatis };
    }));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { academicYearId, majorId, pagu, akreditasi } = await req.json();
    if (!academicYearId || !majorId) {
      return NextResponse.json({ error: "academicYearId dan majorId wajib diisi." }, { status: 400 });
    }

    const [year, major] = await Promise.all([
      prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
      prisma.major.findUnique({ where: { id: majorId }, select: { code: true } }),
    ]);
    if (!year || !major) return NextResponse.json({ error: "Tahun ajaran/jurusan tidak ditemukan." }, { status: 404 });

    if (typeof akreditasi === "string") {
      await prisma.major.update({ where: { id: majorId }, data: { akreditasi: akreditasi || null } });
    }

    if (pagu !== undefined) {
      const current = parsePagu((await getSettings(["nominatif.pagu"]))["nominatif.pagu"]);
      current[year.name] = { ...(current[year.name] ?? {}), [major.code]: Number(pagu) || 0 };
      await prisma.siteSetting.upsert({
        where: { key: "nominatif.pagu" },
        update: { value: JSON.stringify(current) },
        create: { key: "nominatif.pagu", value: JSON.stringify(current) },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
