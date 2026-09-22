import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getNominatifRoster } from "@/lib/nominatif-roster";

export const dynamic = "force-dynamic";

// Daftar siswa Kelas XII SELURUH jurusan untuk tahun ajaran terpilih — dipakai tabel "Data Siswa
// Kelas XII" di NominatifManager.tsx (pola "load semua + filter Kelas/cari di client", §5.6
// DESIGN_SYSTEM, sesuai contoh BukuIndukSiswaManager yang direferensikan user). Field yang sama
// persis dipakai dokumen cetak Nominatif (getNominatifRoster, satu sumber) — supaya admin bisa
// lihat DI TABEL ini data siapa yang masih kosong sebelum cetak resmi (keputusan eksplisit user
// 2026-09-11: "tampilkan semua data yang dibutuhkan ... agar kelihatan data mana yang belum
// lengkap"), bukan cuma kolom ringkas.
export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const academicYearId = req.nextUrl.searchParams.get("academicYearId");
    if (!academicYearId) return NextResponse.json({ error: "academicYearId wajib diisi" }, { status: 400 });

    const year = await prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { isActive: true } });
    if (!year) return NextResponse.json({ error: "Tahun ajaran tidak ditemukan" }, { status: 404 });

    const rows = await getNominatifRoster({ id: academicYearId, isActive: year.isActive });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
