import { NextRequest, NextResponse } from "next/server";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Kode akhir NIS per jurusan — format baku sekolah ini: {urut_global}/{urut_per_jurusan}.{kode_jurusan}.
// Dulu hardcode di sini, sekarang diambil dari Major.nisCode (bisa diedit admin di Kelola Jurusan)
// supaya jurusan baru tidak perlu ubah kode aplikasi.

export async function GET(req: NextRequest) {
  await verifyBukuIndukFullAccess();
  const majorCode = req.nextUrl.searchParams.get("majorCode") ?? "";
  const targetMajor = await prisma.major.findUnique({ where: { code: majorCode }, select: { nisCode: true } });
  const suffix = targetMajor?.nisCode;
  if (!suffix) return NextResponse.json({ error: "Jurusan ini belum punya Kode Jurusan (NIS) — isi dulu di Kelola Jurusan." }, { status: 400 });

  const students = await prisma.student.findMany({
    where: { nis: { contains: "/" } },
    select: { nis: true, major: { select: { code: true } } },
  });

  let maxGlobal = 0, maxMajor = 0;
  for (const s of students) {
    const m = s.nis.match(/^(\d+)\/(\d+)\./);
    if (!m) continue;
    maxGlobal = Math.max(maxGlobal, parseInt(m[1], 10));
    if (s.major.code === majorCode) maxMajor = Math.max(maxMajor, parseInt(m[2], 10));
  }

  const nis = `${maxGlobal + 1}/${String(maxMajor + 1).padStart(3, "0")}.${suffix}`;
  return NextResponse.json({ nis });
}
