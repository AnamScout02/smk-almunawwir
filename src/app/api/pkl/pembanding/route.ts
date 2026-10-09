import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";

/** Hari kerja (Senin–Sabtu) dari `a` sampai `b` inklusif — pembagi "jurnal terisi". */
function hariKerja(a: Date, b: Date) {
  let n = 0;
  for (let t = a.getTime(); t <= b.getTime(); t += 86_400_000) if (new Date(t).getUTCDay() !== 0) n++;
  return n;
}

/** PEMBANDING ANTAR DUDI (9 Okt 2026) — satu tabel untuk memutuskan mitra mana yang dilanjutkan. Semua angka dari
 *  data yang sudah ada; `saran` disusun dengan ATURAN dan selalu disertai alasannya — keputusan tetap pada Humas. */
export async function GET() {
  try {
    await sesiPkl();
    const hariIni = new Date(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) + "T00:00:00Z");
    const [dudi, pkl, mutasi] = await Promise.all([
      prisma.industryPartner.findMany({ select: { id: true, name: true, industryField: true, quota: true, aktif: true, mouEndDate: true }, orderBy: { name: "asc" } }),
      prisma.internship.findMany({
        where: { mitraId: { not: null }, status: { in: ["ONGOING", "COMPLETED"] } },
        select: {
          mitraId: true, status: true, startDate: true, endDate: true, nilaiIndustriRata: true, umpanBalik: true,
          _count: { select: { journal: true, monitoring: true, laporanMasalah: true } },
          presensi: { select: { status: true } },
        },
      }),
      prisma.mutasiPkl.groupBy({ by: ["dariMitraId"], where: { dariMitraId: { not: null } }, _count: { _all: true } }),
    ]);
    const keluar = new Map(mutasi.map(m => [m.dariMitraId as string, m._count._all]));
    const rata = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
    return Response.json({
      dudi: dudi.map(d => {
        const p = pkl.filter(x => x.mitraId === d.id);
        let hari = 0, jurnal = 0;
        for (const x of p) {
          const akhir = x.endDate < hariIni ? x.endDate : hariIni;
          if (x.startDate <= akhir) hari += hariKerja(x.startDate, akhir);
          jurnal += x._count.journal;
        }
        const presensi = p.flatMap(x => x.presensi);
        const bintang = p.map(x => Number((x.umpanBalik as { bintang?: unknown } | null)?.bintang)).filter(n => n >= 1 && n <= 5);
        const jurnalPersen = hari > 0 ? Math.min(100, Math.round((jurnal / hari) * 100)) : null;
        const hadirPersen = presensi.length ? Math.round((presensi.filter(x => x.status === "HADIR").length / presensi.length) * 100) : null;
        const nilai = rata(p.map(x => x.nilaiIndustriRata).filter((n): n is number => typeof n === "number"));
        const masalah = p.reduce((a, x) => a + x._count.laporanMasalah, 0), pindah = keluar.get(d.id) ?? 0;
        const alasan: string[] = [];
        if (masalah >= 2) alasan.push(`${masalah} laporan masalah`);
        if (pindah >= 1) alasan.push(`${pindah} siswa pindah keluar`);
        if (nilai != null && nilai < 70) alasan.push(`nilai industri ${nilai}`);
        if (jurnalPersen != null && hari >= 20 && jurnalPersen < 40) alasan.push(`jurnal terisi ${jurnalPersen}%`);
        if (hadirPersen != null && presensi.length >= 20 && hadirPersen < 75) alasan.push(`kehadiran ${hadirPersen}%`);
        const selesai = p.filter(x => x.status === "COMPLETED").length;
        return {
          id: d.id, nama: d.name, bidang: d.industryField, aktif: d.aktif, kuota: d.quota,
          siswa: p.length, selesai, jurnalPersen, hadirPersen, nilai, masalah, pindah,
          monitoring: p.reduce((a, x) => a + x._count.monitoring, 0), umpanBalik: rata(bintang), jumlahUmpan: bintang.length,
          saran: p.length === 0 ? "BELUM" : alasan.length ? "TINJAU" : selesai === 0 && hari < 20 ? "BELUM" : "LANJUT",
          alasan,
        };
      }),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
