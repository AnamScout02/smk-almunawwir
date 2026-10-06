import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { rekapAnalisisKegiatan } from "@/lib/analisis-butir-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** Unduh rekap analisis butir satu kegiatan (.xlsx): Ringkasan per ujian + Butir Perlu Revisi. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const kegiatanId = new URL(req.url).searchParams.get("kegiatanId") ?? "";
    const k = await prisma.kegiatanUjian.findUnique({ where: { id: kegiatanId }, select: { nama: true, singkatan: true } });
    if (!k) return new Response("Kegiatan tidak ditemukan", { status: 404 });
    const ujian = await rekapAnalisisKegiatan(session, kegiatanId);
    return balasanExcelBanyakSheet(`analisis-butir-${(k.singkatan || k.nama).replace(/[^\w]+/g, "-").toLowerCase()}`, [
      {
        nama: "Ringkasan Ujian",
        headers: ["No", "Mapel", "Ujian", "Jenis", "Kelas", "Peserta", "Butir", "Perlu Revisi", "Reliabilitas", "Kategori", "Rerata"],
        rows: ujian.map((u, i) => [i + 1, u.mapel, u.judul, u.jenis, u.kelas, u.peserta, u.butir, u.perluRevisi,
          u.reliabilitas?.alpha ?? "", u.reliabilitas?.kategori ?? "", u.rerata ?? ""]),
      },
      {
        nama: "Butir Perlu Revisi",
        headers: ["Mapel", "Ujian", "No Soal", "Tipe", "Kesukaran", "Daya Beda", "Alasan", "Cuplikan Soal"],
        rows: ujian.flatMap(u => u.revisi.map(r => [u.mapel, u.judul, r.nomor, r.tipe, r.kesukaran ?? "", r.dayaBeda ?? "", r.alasan.join("; "), r.cuplikan])),
      },
    ]);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return new Response("Gagal menyusun berkas.", { status: 500 });
  }
}
