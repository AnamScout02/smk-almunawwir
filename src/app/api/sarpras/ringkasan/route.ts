import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, FILTER_KERUSAKAN_LAB, LAB_ASSET_FILTER } from "@/lib/sarpras-akses";
import { bagianWib } from "@/lib/waktu-wib";

export const dynamic = "force-dynamic";

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

/** RINGKASAN SARPRAS / LAB untuk dashboard (?lingkup=LAB). Kepala Lab tanpa jabatan Sarpras selalu lingkup LAB. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const lab = !a.penuh || new URL(req.url).searchParams.get("lingkup") === "LAB";
  const w = bagianWib();
  const awal = new Date(`${w.iso}T00:00:00+07:00`), akhir = new Date(awal.getTime() + 86400000);
  const sepekan = new Date(awal.getTime() + 8 * 86400000);
  const fAset: Prisma.AssetWhereInput = lab ? LAB_ASSET_FILTER : {};
  const fLingkup = lab ? { lingkup: "LAB" } : {};
  const hari = HARI[new Date(awal.getTime() + 7 * 3600_000).getUTCDay()];

  const [kondisi, kerusakan, menunggu, dipinjam, terlambatKembali, perawatan, opname, pakaiHariIni, jadwalLab] = await Promise.all([
    prisma.asset.groupBy({ by: ["condition"], where: fAset, _sum: { quantity: true }, _count: { _all: true } }),
    prisma.assetDamageReport.findMany({
      where: { status: { not: "SELESAI" }, ...(lab ? FILTER_KERUSAKAN_LAB : {}) },
      orderBy: [{ prioritas: "desc" }, { reportDate: "asc" }], take: 8,
      select: { id: true, judul: true, lokasi: true, description: true, prioritas: true, status: true, reportDate: true, reportedBy: true, asset: { select: { name: true, location: true } } },
    }),
    prisma.peminjamanSarpras.count({ where: { status: "MENUNGGU", ...fLingkup } }),
    prisma.peminjamanSarpras.count({ where: { status: "DIPINJAM", ...fLingkup } }),
    prisma.peminjamanSarpras.count({ where: { status: "DIPINJAM", selesai: { lt: new Date() }, ...fLingkup } }),
    prisma.jadwalPerawatan.findMany({
      where: { aktif: true, berikutnya: { lt: sepekan }, ...fLingkup }, orderBy: { berikutnya: "asc" }, take: 8,
      select: { id: true, judul: true, berikutnya: true, lokasi: true, asset: { select: { name: true } } },
    }),
    prisma.stokOpname.findFirst({ where: { status: "BERJALAN", ...(lab ? { lingkup: "LAB" } : {}) }, select: { id: true, judul: true, _count: { select: { item: true } } } }),
    prisma.peminjamanSarpras.findMany({
      where: { status: { in: ["DISETUJUI", "DIPINJAM"] }, mulai: { lt: akhir }, selesai: { gt: awal }, ...fLingkup },
      orderBy: { mulai: "asc" }, take: 12,
      select: { id: true, jenis: true, ruang: true, peminjamNama: true, keperluan: true, mulai: true, selesai: true, asset: { select: { name: true } } },
    }),
    lab ? prisma.schedule.findMany({
      where: { day: hari, room: { contains: "lab", mode: "insensitive" } },
      orderBy: [{ room: "asc" }, { startTime: "asc" }],
      select: { room: true, startTime: true, endTime: true, subject: true, class: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
    }) : Promise.resolve([]),
  ]);
  const jumlah = (k: string) => kondisi.find(x => x.condition === k)?._count._all ?? 0;
  return Response.json({
    lab, tanggal: w.iso,
    aset: { jenis: kondisi.reduce((s, x) => s + x._count._all, 0), unit: kondisi.reduce((s, x) => s + (x._sum.quantity ?? 0), 0), baik: jumlah("BAIK"), rusakRingan: jumlah("RUSAK_RINGAN"), rusakBerat: jumlah("RUSAK_BERAT") },
    kerusakan, menunggu, dipinjam, terlambatKembali, perawatan,
    opname: opname ? { id: opname.id, judul: opname.judul, item: opname._count.item } : null,
    pakaiHariIni,
    jadwalLab: jadwalLab.map(j => ({ ruang: j.room, jam: `${j.startTime}–${j.endTime}`, kelas: j.class.name, mapel: j.subject, guru: j.teacher?.user.name ?? "-" })),
  });
}
