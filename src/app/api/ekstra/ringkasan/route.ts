import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ekskulBoleh, hariWibIso } from "@/lib/ekstra-server";

export const dynamic = "force-dynamic";

/** Ringkasan Pusat Ekstrakurikuler: tiap ekskul yang boleh dilihat + keadaan bulan berjalan (WIB). */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { akses, daftar } = await ekskulBoleh(session);
  if (!akses.masuk) return Response.json({ error: "Menu ini untuk koordinator dan pembina ekstrakurikuler." }, { status: 403 });
  const hariIni = hariWibIso(), awalBulan = new Date(`${hariIni.slice(0, 8)}01T00:00:00Z`);
  const ids = daftar.map(d => d.id);
  const [jurnal, agenda, pembina] = await Promise.all([
    prisma.extracurricularJournal.findMany({
      where: { extracurricularId: { in: ids }, date: { gte: new Date(awalBulan.getTime() - 62 * 86400000) } },
      select: { extracurricularId: true, date: true, foto: true, sumber: true, entries: { select: { status: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.agendaEkstra.findMany({ where: { extracurricularId: { in: ids }, mulai: { gte: new Date(`${hariIni}T00:00:00Z`) } }, orderBy: { mulai: "asc" }, take: 40, select: { extracurricularId: true, judul: true, jenis: true, mulai: true, tempat: true } }),
    // Pembina ber-AKUN = pemegang jabatan "Pembina <nama ekskul>" (guru maupun staf).
    prisma.jabatan.findMany({
      where: { name: { in: daftar.map(d => `Pembina ${d.name}`) } },
      select: { name: true, teachers: { select: { teacher: { select: { user: { select: { name: true } } } } } }, staff: { select: { user: { select: { name: true } } } } },
    }).catch(() => []),
  ]);
  const menunggu = await prisma.pendaftaranEkstra.groupBy({ by: ["extracurricularId"], where: { status: "MENUNGGU", extracurricularId: { in: ids }, student: { studentStatus: "AKTIF" } }, _count: { _all: true } }).catch(() => []);
  const ekskul = daftar.map(d => {
    const semua = jurnal.filter(j => j.extracurricularId === d.id), bulan = semua.filter(j => j.date >= awalBulan);
    const entri = bulan.flatMap(j => j.entries), hadir = entri.filter(e => e.status === "HADIR").length;
    const jab = pembina.find(p => p.name === `Pembina ${d.name}`);
    return {
      id: d.id, nama: d.name, jenis: d.jenis, anggota: d._count.members, jadwalRutin: d.jadwalRutin, hariRutin: d.hariRutin, bukaDaftar: d.bukaDaftar, kuota: d.kuota, deskripsi: d.deskripsi,
      pendaftar: menunggu.find(m => m.extracurricularId === d.id)?._count._all ?? 0,
      pembinaAkun: jab ? [...jab.teachers.map(t => t.teacher.user.name), ...jab.staff.map(s => s.user.name)] : [],
      pembinaLuar: d.pembinaNama, pembinaKontak: akses.kelola ? d.pembinaKontak : null, adaTautan: !!d.tokenPortalHash, tautanDipakai: d.tokenPortalDipakai?.toISOString() ?? null,
      pertemuanBulanIni: bulan.length, persenHadir: entri.length ? Math.round((hadir / entri.length) * 100) : null,
      fotoBulanIni: bulan.reduce((n, j) => n + j.foto.length, 0), tanpaFoto: bulan.filter(j => j.foto.length === 0).length,
      terakhir: semua[0]?.date.toISOString().slice(0, 10) ?? null,
      agenda: agenda.filter(a => a.extracurricularId === d.id).slice(0, 3),
    };
  });
  return Response.json({ kelola: akses.kelola, hariIni, ekskul });
}
