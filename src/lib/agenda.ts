import "server-only";
import { prisma } from "@/lib/prisma";

/** Agenda bersama yang tampil di dashboard SEMUA role — hanya program kerja milik jabatan
 * "Wakil Kepala *" (Kurikulum/Kesiswaan/Sarpras/Humas/Bidang Penjamin Mutu), bukan semua jabatan. */
export async function getWakilKepalaAgenda() {
  return prisma.programKerja.findMany({
    where: { jabatan: { name: { startsWith: "Wakil Kepala" } }, status: { not: "BATAL" } },
    include: { jabatan: { select: { name: true } } },
    orderBy: { tanggalMulai: "asc" },
    take: 8,
  });
}
