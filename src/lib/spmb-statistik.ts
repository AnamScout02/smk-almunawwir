import "server-only";
import { prisma } from "@/lib/prisma";
import { TAHAP_JEJAK } from "@/lib/spmb-jejak";
import { bakuNamaSekolah, kunciSekolah } from "@/lib/nama-sekolah";

/** Statistik SPMB — SATU sumber untuk halaman SPMB publik (peringkat perujuk tersamar, pendaftar
 *  terbaru) dan halaman Statistik panitia (corong, asal sekolah, peringkat utuh; peta sebaran wilayah di peta-sebaran.ts).
 *  Semua kueri dibungkus .catch supaya halaman publik tidak pernah gagal karena statistik. */

/** Pendaftar yang statusnya ditolak tetap dihitung di peringkat perujuk (perujuk sudah membawa
 *  orang), tetapi TIDAK dihitung di sebaran — sebaran dipakai menilai daerah promosi yang berhasil. */
const BUKAN_DITOLAK = { status: { notIn: ["DITOLAK", "REJECTED"] } };

export async function peringkatPerujuk(batas = 10) {
  const grup = await prisma.admission.groupBy({
    by: ["perujukId"], where: { perujukId: { not: null } }, _count: { _all: true },
    orderBy: { _count: { perujukId: "desc" } }, take: batas,
  }).catch(() => []);
  if (!grup.length) return [];
  const orang = await prisma.perujukSpmb.findMany({
    where: { id: { in: grup.map(g => g.perujukId!) } }, select: { id: true, nama: true, jenis: true, kode: true },
  }).catch(() => []);
  return grup.map(g => ({ ...orang.find(o => o.id === g.perujukId), jumlah: g._count._all }))
    .filter((x): x is { id: string; nama: string; jenis: string; kode: string; jumlah: number } => !!x.id);
}

export async function pendaftarSejak(hari: number) {
  return prisma.admission.count({ where: { createdAt: { gte: new Date(Date.now() - hari * 86_400_000) } } }).catch(() => 0);
}

/** Asal sekolah diketik bebas — diseragamkan (huruf besar, spasi & tanda baca dirapikan, "SMPN" =
 *  "SMP NEGERI") supaya "SMPN 1 Songgon" dan "smp negeri 1 songgon" terhitung satu sekolah. */
// Kunci & penulisan baku satu sumber: src/lib/nama-sekolah.ts (tanda hubung, singkatan, apostrof diabaikan).
export async function sebaranSekolah(batas = 30) {
  const semua = await prisma.admission.findMany({ where: BUKAN_DITOLAK, select: { previousSchool: true } }).catch(() => []);
  const peta = new Map<string, { nama: string; jumlah: number }>();
  for (const a of semua) {
    const k = kunciSekolah(a.previousSchool ?? "");
    if (!k) continue;
    const ada = peta.get(k);
    if (ada) ada.jumlah++; else peta.set(k, { nama: bakuNamaSekolah(a.previousSchool), jumlah: 1 });
  }
  return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, batas);
}

/** Corong: jumlah peramban UNIK yang mencapai tiap tahap sejak tanggal tertentu. */
export async function corongPendaftaran(sejak: Date) {
  const grup = await prisma.spmbJejak.groupBy({
    by: ["tahap"], where: { createdAt: { gte: sejak } }, _count: { _all: true },
  }).catch(() => []);
  const n = (k: string) => grup.find(g => g.tahap === k)?._count._all ?? 0;
  return { tahap: TAHAP_JEJAK.map(t => ({ ...t, jumlah: n(t.kode) })), kuis: n("KUIS") };
}
