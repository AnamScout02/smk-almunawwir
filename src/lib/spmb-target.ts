import "server-only";
import { prisma } from "@/lib/prisma";

/** TARGET vs CAPAIAN per gelombang (7 Okt 2026) — Statistik & Sebaran SPMB.
 *  Target = `GelombangSpmb.target`, atau (0) jumlah kuota jurusan gelombang itu. Garis ideal naik rata dari
 *  tanggal buka sampai tutup. Pembanding tahun lalu = pendaftar pada rentang tanggal yang sama setahun
 *  sebelumnya (hari ke-n gelombang ↔ hari ke-n tahun lalu) — hanya tampil bila datanya ada. Hari dihitung WIB. */
const HARI = 86_400_000;
const wib = (d: Date) => Math.floor((d.getTime() + 7 * 3600_000) / HARI);

export type TitikTarget = { hari: number; tanggal: string; kumulatif: number | null; ideal: number; tahunLalu: number | null };
export type TargetGelombang = {
  id: string; nama: string; target: number; dariKuota: boolean; buka: string; tutup: string;
  hariTotal: number; hariBerjalan: number; capaian: number; ideal: number; tahunLaluTotal: number | null;
  perluPerHari: number | null; deret: TitikTarget[];
};

export async function targetGelombang(): Promise<TargetGelombang[]> {
  const gel = await prisma.gelombangSpmb.findMany({
    orderBy: { urutan: "asc" },
    select: { id: true, nama: true, buka: true, tutup: true, target: true, kuota: { select: { kuota: true } } },
  }).catch(() => []);
  const hariIni = wib(new Date());
  const hasil: TargetGelombang[] = [];
  for (const g of gel) {
    const kuota = g.kuota.reduce((a, k) => a + k.kuota, 0);
    const target = g.target || kuota;
    const d0 = wib(g.buka), d1 = wib(g.tutup);
    const hariTotal = Math.max(1, d1 - d0 + 1);
    const setahun = 365 * HARI;
    const [ini, lalu] = await Promise.all([
      prisma.admission.findMany({ where: { gelombangId: g.id }, select: { createdAt: true } }),
      prisma.admission.findMany({
        where: { createdAt: { gte: new Date(g.buka.getTime() - setahun), lte: new Date(g.tutup.getTime() - setahun) } },
        select: { createdAt: true },
      }),
    ]).catch(() => [[], []] as const);
    const perHari = new Array(hariTotal).fill(0);
    for (const a of ini) { const i = Math.min(hariTotal - 1, Math.max(0, wib(a.createdAt) - d0)); perHari[i]++; }
    const perHariLalu = new Array(hariTotal).fill(0);
    for (const a of lalu) { const i = Math.min(hariTotal - 1, Math.max(0, wib(a.createdAt) + 365 - d0)); perHariLalu[i]++; }
    const hariBerjalan = Math.min(hariTotal, Math.max(0, hariIni - d0 + 1));
    let k = 0, kl = 0;
    const deret: TitikTarget[] = perHari.map((n, i) => {
      k += n; kl += perHariLalu[i];
      return {
        hari: i + 1, tanggal: new Date((d0 + i) * HARI).toISOString().slice(0, 10),
        kumulatif: i < hariBerjalan ? k : null, ideal: Math.round((target * (i + 1)) / hariTotal), tahunLalu: lalu.length ? kl : null,
      };
    });
    const capaian = ini.length;
    const sisaHari = hariTotal - hariBerjalan;
    hasil.push({
      id: g.id, nama: g.nama, target, dariKuota: !g.target, buka: g.buka.toISOString(), tutup: g.tutup.toISOString(),
      hariTotal, hariBerjalan, capaian, ideal: hariBerjalan ? deret[hariBerjalan - 1].ideal : 0,
      tahunLaluTotal: lalu.length || null,
      perluPerHari: target > capaian && sisaHari > 0 && hariBerjalan > 0 ? Math.ceil((target - capaian) / sisaHari) : null,
      deret,
    });
  }
  return hasil;
}
