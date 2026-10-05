import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const DITERIMA = ["DITERIMA", "ACCEPTED"];

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") || undefined;
    const pendaftar = await prisma.admission.findMany({
      where: { status: { in: DITERIMA }, ...(gelombangId ? { gelombangId } : {}) },
      orderBy: [{ chosenMajor: "asc" }, { fullName: "asc" }],
      select: {
        id: true, nomor: true, fullName: true, chosenMajor: true, phone: true, skorAkhir: true,
        buktiPembayaranUrl: true, daftarUlangConfirmedAt: true, paymentVerified: true,
        studentId: true, dikonversiPada: true,
        gelombang: { select: { id: true, nama: true } },
      },
    });
    return NextResponse.json(pendaftar);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Verifikasi pembayaran daftar ulang (dan pembatalannya). Tidak menyentuh status penerimaan. */
export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const id = String(b?.id ?? "");
    if (!id) return NextResponse.json({ error: "Pendaftar tidak disebut" }, { status: 400 });
    const lunas = b?.paymentVerified === true;

    const p = await prisma.admission.findUnique({ where: { id }, select: { fullName: true, status: true } });
    if (!p) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    if (!DITERIMA.includes(p.status)) return NextResponse.json({ error: "Daftar ulang hanya untuk pendaftar yang diterima" }, { status: 409 });

    await prisma.admission.update({
      where: { id },
      data: {
        paymentVerified: lunas,
        // Dicatat sebagai sudah daftar ulang begitu pembayarannya disahkan petugas, walau calon
        // tidak mengisi halaman /daftar-ulang sendiri (banyak yang datang langsung ke sekolah).
        daftarUlangConfirmedAt: lunas ? (b?.tanggal ? new Date(String(b.tanggal) + "T00:00:00+07:00") : new Date()) : null,
      },
    });
    await logActivity(session, {
      action: "UPDATE", entity: "Admission", entityId: id,
      description: `${lunas ? "Mengesahkan" : "Membatalkan"} daftar ulang ${p.fullName}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
