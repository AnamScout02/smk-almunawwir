import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdmissionToken } from "@/lib/admission-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`daftar-ulang-submit:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const body = await req.json();
  const { token, buktiPembayaranUrl } = body;
  const admissionId = token ? await verifyAdmissionToken(token) : null;
  if (!admissionId) {
    return NextResponse.json({ error: "Sesi tidak valid atau sudah kedaluwarsa. Silakan verifikasi ulang." }, { status: 401 });
  }
  if (!buktiPembayaranUrl) {
    return NextResponse.json({ error: "Unggah bukti pembayaran terlebih dahulu." }, { status: 400 });
  }

  const admission = await prisma.admission.findFirst({ where: { id: admissionId, status: "ACCEPTED" } });
  if (!admission) {
    return NextResponse.json({ error: "Data pendaftaran tidak ditemukan." }, { status: 404 });
  }

  const updated = await prisma.admission.update({
    where: { id: admissionId },
    data: { buktiPembayaranUrl, daftarUlangConfirmedAt: new Date() },
  });

  return NextResponse.json({ success: true, daftarUlangConfirmedAt: updated.daftarUlangConfirmedAt });
}
