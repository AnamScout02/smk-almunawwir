import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, muatPeserta, sesiPkl, terisiPerDudi } from "@/lib/pkl-server";
import { keadaanMou } from "@/lib/pkl-label";
import { hitungPeringatanPkl } from "@/lib/pkl-peringatan";

export const dynamic = "force-dynamic";

/** DASBOR PUSAT PKL — satu layar keadaan PKL. Angkanya dari `muatPeserta` yang sama dengan layar Penempatan & Excel. */
export async function GET() {
  try {
    await sesiPkl();
    const kini = new Date();
    const hariIni = new Date(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) + "T00:00:00Z");
    const tigaPuluh = new Date(kini.getTime() - 30 * 86_400_000);
    const [peserta, dudi, terisi, laporan, monitorBaru, pendaftaran, peringatan, laporanAkhir] = await Promise.all([
      muatPeserta(),
      prisma.industryPartner.findMany({ select: { id: true, name: true, quota: true, aktif: true, mouEndDate: true, industryField: true, kecamatan: true }, orderBy: { name: "asc" } }),
      terisiPerDudi(),
      prisma.laporanPkl.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.monitoringPkl.findMany({ where: { tanggal: { gte: tigaPuluh } }, select: { internshipId: true }, distinct: ["internshipId"] }),
      prisma.pklRegistration.count({ where: { status: "PENDING" } }),
      hitungPeringatanPkl().then(x => x.length).catch(() => 0),
      prisma.internship.count({ where: { laporanAkhirStatus: "DIKIRIM" } }),
    ]);
    const aktif = peserta.filter(p => p.status !== "CANCELLED");
    const ditempatkan = aktif.filter(p => p.tempat);
    const belum = aktif.filter(p => !p.tempat);
    const berjalan = ditempatkan.filter(p => p.status === "ONGOING" && new Date(p.mulai) <= hariIni && new Date(p.selesai) >= hariIni);
    const akanMulai = ditempatkan.filter(p => p.status === "ONGOING" && new Date(p.mulai) > hariIni);
    const lewat = ditempatkan.filter(p => p.status === "ONGOING" && new Date(p.selesai) < hariIni);
    const sudahMonitor = new Set(monitorBaru.map(m => m.internshipId));
    const perKelas = new Map<string, { kelas: string; total: number; belum: number }>();
    for (const p of aktif) {
      const k = p.kelas ?? "Tanpa kelas";
      const x = perKelas.get(k) ?? { kelas: k, total: 0, belum: 0 };
      x.total++; if (!p.tempat) x.belum++;
      perKelas.set(k, x);
    }
    const perLama = new Map<string, number>();
    for (const p of ditempatkan) { const k = p.lamaBulan ? `${p.lamaBulan} bulan` : "Lama belum diisi"; perLama.set(k, (perLama.get(k) ?? 0) + 1); }
    const mou = dudi.map(d => ({ id: d.id, nama: d.name, sampai: d.mouEndDate, ...keadaanMou(d.mouEndDate, kini) }));
    return Response.json({
      angka: {
        peserta: aktif.length, ditempatkan: ditempatkan.length, belum: belum.length, berjalan: berjalan.length,
        akanMulai: akanMulai.length, selesai: aktif.filter(p => p.status === "COMPLETED").length, lewat: lewat.length,
        dudi: dudi.filter(d => d.aktif).length, dudiTerpakai: dudi.filter(d => (terisi.get(d.id) ?? 0) > 0).length,
        tanpaGuru: ditempatkan.filter(p => !p.guruId && p.status === "ONGOING").length,
        belumDiantar: berjalan.filter(p => !p.diantarPada).length,
        monitoringTertunggak: berjalan.filter(p => new Date(p.mulai) <= tigaPuluh && !sudahMonitor.has(p.id)).length,
        tanpaKatalog: aktif.filter(p => p.tanpaKatalog).length,
        laporanBaru: laporan.find(l => l.status === "BARU")?._count._all ?? 0,
        laporanDitangani: laporan.find(l => l.status === "DITANGANI")?._count._all ?? 0,
        mouSegera: mou.filter(m => m.kode === "SEGERA").length, mouHabis: mou.filter(m => m.kode === "HABIS").length,
        pendaftaran, peringatan, laporanAkhir,
      },
      perDudi: dudi.map(d => ({ id: d.id, nama: d.name, bidang: d.industryField, kecamatan: d.kecamatan, kuota: d.quota, terisi: terisi.get(d.id) ?? 0, aktif: d.aktif }))
        .filter(d => d.terisi > 0 || d.aktif).sort((a, b) => b.terisi - a.terisi || a.nama.localeCompare(b.nama)),
      perKelas: [...perKelas.values()].sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true })),
      perLama: [...perLama.entries()].map(([label, jumlah]) => ({ label, jumlah })),
      mou: mou.filter(m => m.kode === "SEGERA" || m.kode === "HABIS"),
      hrefPendaftaran: "/pusat-pkl/pendaftaran",
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
