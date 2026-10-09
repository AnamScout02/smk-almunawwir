import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";

/** MONITORING PER GURU (9 Okt 2026) — siswa bimbingan tiap guru, kunjungan pada bulan terpilih, dan siswa yang
 *  belum dimonitor pada bulan itu (jadwal monitoring yang tertunggak). */
export async function GET(req: NextRequest) {
  try {
    await sesiPkl();
    const b = req.nextUrl.searchParams.get("bulan") ?? "";
    const [y, m] = /^\d{4}-\d{2}$/.test(b) ? b.split("-").map(Number) : [new Date(Date.now() + 7 * 3600_000).getUTCFullYear(), new Date(Date.now() + 7 * 3600_000).getUTCMonth() + 1];
    const dari = new Date(Date.UTC(y, m - 1, 1) - 7 * 3600_000), sampai = new Date(Date.UTC(y, m, 1) - 7 * 3600_000);
    const pkl = await prisma.internship.findMany({
      where: { status: "ONGOING", mitraId: { not: null }, student: { studentStatus: "AKTIF" }, startDate: { lt: sampai }, endDate: { gte: dari } },
      select: {
        id: true, studentId: true, company: true, teacherId: true,
        teacher: { select: { user: { select: { name: true } } } },
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
        monitoring: { where: { tanggal: { gte: dari, lt: sampai } }, select: { cara: true, jarakMeter: true } },
      },
    });
    const peta = new Map<string, { teacherId: string | null; nama: string; siswa: number; dudi: Set<string>; catatan: number; kunjungan: number; diLokasi: number; belum: { studentId: string; nama: string; kelas: string | null; tempat: string }[] }>();
    for (const p of pkl) {
      const k = p.teacherId ?? "";
      const g = peta.get(k) ?? { teacherId: p.teacherId, nama: p.teacher?.user.name ?? "Belum ada guru pembimbing", siswa: 0, dudi: new Set<string>(), catatan: 0, kunjungan: 0, diLokasi: 0, belum: [] };
      g.siswa++; g.dudi.add(p.company); g.catatan += p.monitoring.length;
      g.kunjungan += p.monitoring.filter(x => x.cara === "KUNJUNGAN").length;
      g.diLokasi += p.monitoring.filter(x => x.jarakMeter != null && x.jarakMeter <= 300).length;
      if (!p.monitoring.length) g.belum.push({ studentId: p.studentId, nama: p.student.user.name, kelas: p.student.class?.name ?? null, tempat: p.company });
      peta.set(k, g);
    }
    return Response.json({
      bulan: `${y}-${String(m).padStart(2, "0")}`,
      guru: [...peta.values()].map(g => ({ ...g, dudi: g.dudi.size })).sort((a, b) => b.belum.length - a.belum.length || a.nama.localeCompare(b.nama, "id")),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
