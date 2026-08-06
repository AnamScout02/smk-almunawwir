import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAdmissionToken } from "@/lib/admission-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`daftar-ulang-verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const body = await req.json();
  const { fullName, phone } = body;
  if (!fullName || !phone) {
    return NextResponse.json({ error: "Nama lengkap dan nomor WA wajib diisi" }, { status: 400 });
  }

  const admission = await prisma.admission.findFirst({
    where: { status: "ACCEPTED", phone: String(phone).trim(), fullName: { equals: String(fullName).trim(), mode: "insensitive" } },
    select: {
      id: true, fullName: true, chosenMajor: true, jalur: true,
      buktiPembayaranUrl: true, daftarUlangConfirmedAt: true, paymentVerified: true,
    },
  });

  if (!admission) {
    return NextResponse.json({ error: "Data tidak ditemukan. Pastikan Anda sudah dinyatakan DITERIMA dan data sesuai formulir pendaftaran." }, { status: 404 });
  }

  const token = await signAdmissionToken(admission.id);
  return NextResponse.json({
    token,
    fullName: admission.fullName,
    chosenMajor: admission.chosenMajor,
    jalur: admission.jalur,
    buktiPembayaranUrl: admission.buktiPembayaranUrl,
    daftarUlangConfirmedAt: admission.daftarUlangConfirmedAt,
    paymentVerified: admission.paymentVerified,
  });
}
