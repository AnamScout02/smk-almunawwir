import "server-only";
import { prisma } from "@/lib/prisma";
import { TAHAP_JEJAK } from "@/lib/spmb-jejak";

/** Statistik SPMB — SATU sumber untuk halaman SPMB publik (peringkat perujuk tersamar, pendaftar
 *  terbaru) dan halaman Statistik panitia (corong, sebaran wilayah, asal sekolah, peringkat utuh).
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

export async function sebaranWilayah() {
  const baris = await prisma.admission.groupBy({
    by: ["kabupatenKode", "kabupaten", "kecamatan"], where: BUKAN_DITOLAK, _count: { _all: true },
  }).catch(() => []);
  const kab = new Map<string, { nama: string; jumlah: number; kecamatan: { nama: string; jumlah: number }[] }>();
  for (const b of baris) {
    const kunci = b.kabupatenKode ?? "-";
    const k = kab.get(kunci) ?? { nama: b.kabupaten ?? "Belum memilih wilayah", jumlah: 0, kecamatan: [] };
    k.jumlah += b._count._all;
    if (b.kecamatan) k.kecamatan.push({ nama: b.kecamatan, jumlah: b._count._all });
    kab.set(kunci, k);
  }
  return [...kab.values()]
    .map(k => ({ ...k, kecamatan: k.kecamatan.sort((a, b) => b.jumlah - a.jumlah) }))
    .sort((a, b) => b.jumlah - a.jumlah);
}

/** Asal sekolah diketik bebas — diseragamkan (huruf besar, spasi & tanda baca dirapikan, "SMPN" =
 *  "SMP NEGERI") supaya "SMPN 1 Songgon" dan "smp negeri 1 songgon" terhitung satu sekolah. */
function rapikanSekolah(s: string) {
  return s.toUpperCase().replace(/[.,]/g, " ")
    .replace(/\bSMPN\b/g, "SMP NEGERI").replace(/\bMTSN\b/g, "MTS NEGERI").replace(/\bSMPS\b/g, "SMP SWASTA")
    .replace(/\s+/g, " ").trim();
}
export async function sebaranSekolah(batas = 30) {
  const semua = await prisma.admission.findMany({ where: BUKAN_DITOLAK, select: { previousSchool: true } }).catch(() => []);
  const peta = new Map<string, number>();
  for (const a of semua) {
    const k = rapikanSekolah(a.previousSchool ?? "");
    if (k) peta.set(k, (peta.get(k) ?? 0) + 1);
  }
  return [...peta].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, batas);
}

/** Corong: jumlah peramban UNIK yang mencapai tiap tahap sejak tanggal tertentu. */
export async function corongPendaftaran(sejak: Date) {
  const grup = await prisma.spmbJejak.groupBy({
    by: ["tahap"], where: { createdAt: { gte: sejak } }, _count: { _all: true },
  }).catch(() => []);
  const n = (k: string) => grup.find(g => g.tahap === k)?._count._all ?? 0;
  return { tahap: TAHAP_JEJAK.map(t => ({ ...t, jumlah: n(t.kode) })), kuis: n("KUIS") };
}
