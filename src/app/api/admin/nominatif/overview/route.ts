import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Ringkasan jumlah calon (siswa Kelas XII) per jurusan untuk kartu landing NominatifManager.tsx
// — tahun aktif dihitung LIVE dari Student/Class (data paling akurat "saat ini"), tahun lampau
// dihitung dari StudentClassHistory (snapshot yang di-generate saat kenaikan kelas, lihat
// src/app/api/admin/tahun-ajaran/naik-kelas/route.ts). Sengaja TIDAK ikutkan Pendaftar/Diterima
// PPDB di sini — itu cuma relevan di halaman cetak Rekap Peserta Didik, dihitung langsung di sana.
export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const academicYearId = req.nextUrl.searchParams.get("academicYearId");
    if (!academicYearId) return NextResponse.json({ error: "academicYearId wajib diisi" }, { status: 400 });

    const year = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) return NextResponse.json({ error: "Tahun ajaran tidak ditemukan" }, { status: 404 });

    const majors = await prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });

    let counts: Record<string, number>; // key = majorId
    if (year.isActive) {
      const rows = await prisma.student.groupBy({
        by: ["majorId"],
        where: { studentStatus: "AKTIF", class: { grade: 12 } },
        _count: { _all: true },
      });
      counts = Object.fromEntries(rows.map(r => [r.majorId, r._count._all]));
    } else {
      const rows = await prisma.studentClassHistory.groupBy({
        by: ["majorName"],
        where: { academicYearId, grade: 12, status: { in: ["AKTIF", "LULUS"] } },
        _count: { _all: true },
      });
      // StudentClassHistory simpan majorName (snapshot teks), bukan majorId — cocokkan ke Major.name
      const byName = Object.fromEntries(rows.map(r => [r.majorName, r._count._all]));
      counts = Object.fromEntries(majors.map(m => [m.id, byName[m.name] ?? 0]));
    }

    return NextResponse.json(majors.map(m => ({ majorId: m.id, name: m.name, code: m.code, jumlahCalon: counts[m.id] ?? 0 })));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
