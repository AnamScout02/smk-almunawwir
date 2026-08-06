import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getOrCreateVerificationToken } from "@/lib/verification";
import { generateQrDataUrl } from "@/lib/qrcode";

export const dynamic = "force-dynamic";

/** QR verifikasi untuk semua siswa di satu kelas sekaligus — dipakai cetak Buku Induk per kelas. */
export async function GET(req: NextRequest) {
  await verifyTasAccess();
  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });

  const students = await prisma.student.findMany({ where: { classId }, select: { id: true } });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const entries = await Promise.all(students.map(async (s) => {
    const token = await getOrCreateVerificationToken(s.id);
    const qrDataUrl = await generateQrDataUrl(`${baseUrl}/verify/${token}`);
    return [s.id, qrDataUrl] as const;
  }));

  return NextResponse.json(Object.fromEntries(entries));
}
