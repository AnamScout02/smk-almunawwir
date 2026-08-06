import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Kode akhir NIS per jurusan — format baku sekolah ini: {urut_global}/{urut_per_jurusan}.{kode_jurusan} */
const MAJOR_NIS_SUFFIX: Record<string, string> = {
  TKJ: "4.2.1", AK: "8.3.3", DKV: "10.2.1", DPIB: "1.4.1", ATU: "6.2.2",
};

export async function GET(req: NextRequest) {
  await verifyTasAccess();
  const majorCode = req.nextUrl.searchParams.get("majorCode") ?? "";
  const suffix = MAJOR_NIS_SUFFIX[majorCode];
  if (!suffix) return NextResponse.json({ error: "Kode jurusan tidak dikenali" }, { status: 400 });

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
