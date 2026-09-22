import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";

export const dynamic = "force-dynamic";

/** DETAIL ASET (tujuan QR label) — semua guru & staf melihat ringkasan; pengelola melihat riwayat lengkap. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const { id } = await params;
  const aset = await prisma.asset.findUnique({
    where: { id },
    include: {
      mutasi: { orderBy: { tanggal: "desc" }, take: 20 },
      damageReports: { orderBy: { reportDate: "desc" }, take: 20, select: { id: true, reportDate: true, description: true, status: true, reportedBy: true, repairDate: true, repairNotes: true } },
      perawatan: { select: { id: true, judul: true, berikutnya: true, terakhir: true, intervalHari: true, aktif: true } },
      peminjaman: { where: { status: { in: ["DISETUJUI", "DIPINJAM"] } }, orderBy: { mulai: "asc" }, take: 10, select: { id: true, peminjamNama: true, mulai: true, selesai: true, status: true, jumlah: true } },
    },
  });
  if (!aset) return Response.json({ error: "Aset tidak ditemukan." }, { status: 404 });
  const { mutasi, damageReports, ...inti } = aset;
  return Response.json({
    akses: a,
    aset: inti,
    kerusakanTerbuka: damageReports.filter(d => d.status !== "SELESAI").length,
    riwayat: a.kelola ? { mutasi, kerusakan: damageReports } : null,
  });
}
