import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { bacaKalender } from "@/lib/kalender-import";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const tanggalUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);

export async function POST(req: NextRequest) {
  try {
    const session = await verifyTasAccess();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const academicYearId = String(form.get("academicYearId") ?? "") || null;
    // Agenda yang sudah ada untuk tahun ajaran itu boleh diganti — supaya impor ulang berkas
    // yang sudah dikoreksi tidak menumpuk jadi dobel.
    const ganti = String(form.get("ganti") ?? "") === "1";
    if (!file) return Response.json({ error: "Berkas tidak ditemukan." }, { status: 400 });

    const { agenda, dilewati, lembar } = bacaKalender(Buffer.from(await file.arrayBuffer()));
    if (agenda.length === 0) {
      return Response.json({
        error: "Tidak ada agenda yang terbaca. Pastikan ada lembar berisi kolom Bulan, Tanggal, Agenda, dan Pelaksana.",
      }, { status: 400 });
    }

    let dihapus = 0;
    if (ganti && academicYearId) {
      dihapus = (await prisma.schoolEvent.deleteMany({ where: { academicYearId } })).count;
    }

    await prisma.schoolEvent.createMany({
      data: agenda.map(a => ({
        judul: a.judul,
        tanggalMulai: tanggalUtc(a.tanggalMulai),
        tanggalSelesai: tanggalUtc(a.tanggalSelesai),
        jenis: a.jenis,
        keterangan: a.keterangan,
        hariEfektif: a.hariEfektif,
        tampilPublik: true,
        academicYearId,
        inputById: session.userId,
      })),
    });

    return Response.json({ masuk: agenda.length, dihapus, dilewati, lembar });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal membaca berkas kalender." }, { status: 500 });
  }
}
