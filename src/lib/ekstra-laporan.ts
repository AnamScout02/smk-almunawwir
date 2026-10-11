import "server-only";
import { prisma } from "@/lib/prisma";

/** LAPORAN BULANAN EKSTRAKURIKULER (10 Okt 2026) — satu sumber untuk lembar cetak & Excel: daftar pertemuan bulan itu
 *  (kegiatan, kehadiran, pencatat, foto) + rekap kehadiran per anggota. Dipakai koordinator sebagai bukti kegiatan
 *  pembina (dasar honor) — karena itu lembarnya menyebut berapa pertemuan yang BERFOTO dan siapa yang mencatat. */
export async function laporanBulananEkstra(extracurricularId: string, bulan: string) {
  const [y, m] = bulan.split("-").map(Number);
  const awal = new Date(Date.UTC(y, m - 1, 1)), akhir = new Date(Date.UTC(y, m, 1));
  const [ekskul, jurnal, anggota, agenda, jabatan] = await Promise.all([
    prisma.extracurricular.findUnique({ where: { id: extracurricularId }, select: { id: true, name: true, jenis: true, pembinaNama: true, jadwalRutin: true } }),
    prisma.extracurricularJournal.findMany({
      where: { extracurricularId, date: { gte: awal, lt: akhir } }, orderBy: { date: "asc" },
      select: { date: true, materi: true, foto: true, sumber: true, recordedByName: true, entries: { select: { studentId: true, status: true } } },
    }),
    prisma.extracurricularMember.findMany({
      where: { extracurricularId }, orderBy: { student: { user: { name: "asc" } } },
      select: { studentId: true, role: true, student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    }),
    prisma.agendaEkstra.findMany({ where: { extracurricularId, mulai: { gte: awal, lt: akhir } }, orderBy: { mulai: "asc" }, select: { judul: true, jenis: true, mulai: true, tempat: true, hasil: true } }),
    prisma.jabatan.findMany({ where: { name: { startsWith: "Pembina " } }, select: { name: true, teachers: { select: { teacher: { select: { userId: true, user: { select: { name: true } } } } } }, staff: { select: { userId: true, user: { select: { name: true } } } } } }).catch(() => []),
  ]);
  if (!ekskul) return null;
  const jab = jabatan.find(j => j.name === `Pembina ${ekskul.name}`);
  const pembinaAkun = jab ? [...jab.teachers.map(t => ({ userId: t.teacher.userId, nama: t.teacher.user.name })), ...jab.staff.map(s => ({ userId: s.userId, nama: s.user.name }))] : [];
  const pertemuan = jurnal.map(j => ({
    tanggal: j.date.toISOString().slice(0, 10), kegiatan: j.materi, oleh: j.recordedByName, lewatTautan: j.sumber === "PORTAL", foto: j.foto,
    hadir: j.entries.filter(e => e.status === "HADIR").length, peserta: j.entries.length,
  }));
  const rekap = anggota.map(a => {
    const milik = jurnal.flatMap(j => j.entries.filter(e => e.studentId === a.studentId));
    const n = (s: string) => milik.filter(e => e.status === s).length;
    return { nama: a.student.user.name, nis: a.student.nis, kelas: a.student.class?.name ?? "", peran: a.role ?? "", hadir: n("HADIR"), izin: n("IZIN"), sakit: n("SAKIT"), alpha: n("ALPHA"), total: milik.length, persen: milik.length ? Math.round((n("HADIR") / milik.length) * 100) : null };
  });
  return {
    ekskul, bulan, pembinaAkun, pertemuan, rekap, agenda,
    ringkas: {
      pertemuan: pertemuan.length, berfoto: pertemuan.filter(p => p.foto.length > 0).length, anggota: anggota.length,
      persenHadir: (() => { const e = jurnal.flatMap(j => j.entries); return e.length ? Math.round((e.filter(x => x.status === "HADIR").length / e.length) * 100) : null; })(),
    },
  };
}
