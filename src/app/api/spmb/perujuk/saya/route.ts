import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { LABEL_JENIS } from "@/lib/spmb-perujuk-label";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export const dynamic = "force-dynamic";

/** Kode referral milik AKUN YANG SEDANG MASUK — dipakai kartu referral di halaman Kartu Identitas.
 *  Dicari lewat `userId` (guru/pegawai/akun apa pun) ATAU `studentId` (siswa), karena kode siswa
 *  dibuat bertaut ke baris Student sedangkan kode pegawai bertaut ke User. */
export async function GET() {
  try {
    const session = await verifySession();
    const siswa = session.role === "STUDENT"
      ? await prisma.student.findFirst({ where: { userId: session.userId }, select: { id: true } }).catch(() => null)
      : null;

    const r = await prisma.perujukSpmb.findFirst({
      where: {
        aktif: true,
        OR: [{ userId: session.userId }, ...(siswa ? [{ studentId: siswa.id }] : [])],
      },
      select: { kode: true, nama: true, jenis: true, _count: { select: { pendaftar: true } } },
    }).catch(() => null);

    if (!r) return NextResponse.json({ punya: false });

    const tautan = `${ALAMAT_APLIKASI}/admissions?ref=${encodeURIComponent(r.kode)}`;
    const qr = await generateQrWithLogoDataUrl(tautan).catch(() => "");
    return NextResponse.json({
      punya: true, kode: r.kode, nama: r.nama,
      jenis: r.jenis, label: LABEL_JENIS[r.jenis] ?? r.jenis,
      tautan, qr, pendaftar: r._count.pendaftar,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ punya: false }, { status: 200 });
  }
}
