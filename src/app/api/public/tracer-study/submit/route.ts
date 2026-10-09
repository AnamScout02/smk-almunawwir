import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTracerToken } from "@/lib/tracer-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { pastikanPerujukAlumni } from "@/lib/spmb-perujuk";
import { lupakanSebaranAlumni } from "@/lib/peta-sebaran";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export const dynamic = "force-dynamic";

const STATUS = ["BEKERJA", "KULIAH", "WIRAUSAHA", "BELUM_BEKERJA", "LAINNYA"];
const teks = (v: unknown, maks: number) => (typeof v === "string" ? v.trim().slice(0, maks) : "") || null;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`tracer-submit:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const studentId = await verifyTracerToken(String(body.token ?? ""));
  if (!studentId) {
    return NextResponse.json({ error: "Sesi verifikasi sudah kedaluwarsa. Silakan verifikasi ulang." }, { status: 401 });
  }
  // Status disaring: nilainya dipakai saringan peta & angka keterserapan — teks bebas dari browser merusak hitungannya.
  if (!STATUS.includes(body.status)) {
    return NextResponse.json({ error: "Status wajib dipilih" }, { status: 400 });
  }
  const isi = {
    status: body.status as string,
    institutionName: teks(body.institutionName, 150), position: teks(body.position, 150),
    contactPhone: teks(body.contactPhone, 30), contactEmail: teks(body.contactEmail, 120),
    notes: teks(body.notes, 1000), surveyDate: new Date(),
  };

  const siswa = await prisma.student.findFirst({ where: { id: studentId, studentStatus: "LULUS" }, select: { user: { select: { name: true } } } });
  if (!siswa) return NextResponse.json({ error: "Data alumni tidak ditemukan." }, { status: 404 });

  await prisma.alumniTracer.upsert({ where: { studentId }, update: isi, create: { studentId, ...isi } });
  lupakanSebaranAlumni();

  // Kode referral SPMB untuk alumni — gagal membuatnya tidak boleh menggagalkan tracer yang sudah tersimpan.
  const perujuk = await pastikanPerujukAlumni(studentId, siswa.user.name, isi.contactPhone).catch(() => null);
  return NextResponse.json({
    success: true,
    referral: perujuk ? { kode: perujuk.kode, tautan: `${ALAMAT_APLIKASI}/admissions?ref=${encodeURIComponent(perujuk.kode)}` } : null,
  });
}
