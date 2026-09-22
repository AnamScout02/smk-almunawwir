import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesHumas } from "@/lib/pkl-humas";

export const dynamic = "force-dynamic";

/** DASHBOARD HUMAS (17 Sep 2026): mitra & MoU, PKL berjalan, jurnal macet, penilaian industri, pendaftaran, tracer. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await aksesHumas(session))) return Response.json({ error: "Khusus Wakil Kepala Humas." }, { status: 403 });
  const kini = new Date();
  const enamPuluh = new Date(kini.getTime() + 60 * 86400000);
  const tigaHari = new Date(kini.getTime() - 3 * 86400000);
  const [mitra, pkl, pendaftaran, tracer, monitoringBulanIni] = await Promise.all([
    prisma.industryPartner.findMany({ select: { id: true, name: true, industryField: true, mouStartDate: true, mouEndDate: true, quota: true, contactPerson: true, contactPhone: true }, orderBy: { name: "asc" } }),
    prisma.internship.findMany({
      where: { student: { studentStatus: "AKTIF" } },
      select: {
        id: true, studentId: true, company: true, status: true, startDate: true, endDate: true, nilaiIndustriRata: true, teacherId: true,
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
        journal: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
        _count: { select: { monitoring: true } },
      },
    }),
    prisma.pklRegistration.count({ where: { status: "PENDING" } }),
    prisma.alumniTracer.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.monitoringPkl.count({ where: { tanggal: { gte: new Date(kini.getTime() - 30 * 86400000) } } }),
  ]);
  const berjalan = pkl.filter(p => p.status === "ONGOING");
  const perPerusahaan = [...berjalan.reduce((m, p) => m.set(p.company, (m.get(p.company) ?? 0) + 1), new Map<string, number>())]
    .map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
  return Response.json({
    mitra: {
      total: mitra.length,
      mouAktif: mitra.filter(m => m.mouEndDate && m.mouEndDate >= kini).length,
      segeraBerakhir: mitra.filter(m => m.mouEndDate && m.mouEndDate >= kini && m.mouEndDate <= enamPuluh).map(m => ({ id: m.id, nama: m.name, sampai: m.mouEndDate, kontak: m.contactPerson, telepon: m.contactPhone })),
      kedaluwarsa: mitra.filter(m => m.mouEndDate && m.mouEndDate < kini).map(m => ({ id: m.id, nama: m.name, sampai: m.mouEndDate })),
      tanpaMou: mitra.filter(m => !m.mouEndDate).length,
      daftar: mitra.map(m => ({ id: m.id, nama: m.name, bidang: m.industryField, kuota: m.quota, terisi: perPerusahaan.find(p => p.nama.toLowerCase() === m.name.toLowerCase())?.jumlah ?? 0 })),
    },
    pkl: {
      berjalan: berjalan.length,
      selesai: pkl.filter(p => p.status === "COMPLETED").length,
      tanpaPembimbing: berjalan.filter(p => !p.teacherId).length,
      jurnalMacet: berjalan.filter(p => p.startDate <= tigaHari && (!p.journal[0] || p.journal[0].date < tigaHari))
        .map(p => ({ studentId: p.studentId, nama: p.student.user.name, kelas: p.student.class?.name ?? "-", perusahaan: p.company, pembimbing: p.teacher?.user.name ?? "-", terakhir: p.journal[0]?.date ?? null })).slice(0, 30),
      belumDinilaiIndustri: pkl.filter(p => p.nilaiIndustriRata == null && p.endDate <= new Date(kini.getTime() + 14 * 86400000) && p.status !== "CANCELLED").length,
      belumDimonitor: berjalan.filter(p => p._count.monitoring === 0).length,
      perPerusahaan: perPerusahaan.slice(0, 12),
    },
    pendaftaran, monitoringBulanIni,
    tracer: tracer.map(t => ({ status: t.status, jumlah: t._count._all })),
  });
}
