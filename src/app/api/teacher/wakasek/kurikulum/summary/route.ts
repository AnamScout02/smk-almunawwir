import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { getJournalGradeAggregates } from "@/lib/journal-grades";
import { bagianWib } from "@/lib/waktu-wib";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { petaKkm } from "@/lib/kkm";
import { SYARAT_JP, ekuivalensiJabatan } from "@/lib/beban-jp";

export const dynamic = "force-dynamic";

/** DASHBOARD WAKASEK KURIKULUM (diperkaya 17 Sep 2026): progres penilaian & kunci rapor per kelas, guru yang belum menilai,
 * ketuntasan KKM per mapel, beban JP per guru (syarat 24 JP), jurnal belum diisi 7 hari, kelas tanpa jadwal. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Wakil Kepala Kurikulum"]);

    const w = bagianWib();
    const semester = semesterRapor()[w.bulan >= 7 ? 2 : 3];
    const since = new Date(Date.now() - 7 * 86400000);

    const [assignments, recentJournals, grades, classes, guru, kunci, sah] = await Promise.all([
      prisma.teachingAssignment.findMany({
        select: {
          teacherId: true, classId: true,
          teacher: { select: { user: { select: { name: true } } } },
          class: { select: { name: true } },
          subject: { select: { name: true, hoursPerWeek: true } },
        },
      }),
      prisma.teachingJournal.findMany({ where: { date: { gte: since } }, select: { teacherId: true, classId: true, subject: true } }),
      getJournalGradeAggregates({ semester }),
      prisma.class.findMany({
        select: {
          id: true, name: true, grade: true, majorId: true, _count: { select: { schedules: true } },
          homeroom: { select: { user: { select: { name: true } } } },
          students: { where: { studentStatus: "AKTIF" }, select: { id: true } },
        },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      }),
      prisma.teacher.findMany({
        where: { OR: [{ teacherStatus: "AKTIF" }, { teacherStatus: null }] },
        select: { id: true, user: { select: { name: true } }, jabatan: { select: { jabatan: { select: { name: true } } } }, _count: { select: { homeroomOf: true } } },
      }),
      prisma.raporKunci.findMany({ where: { semester }, select: { classId: true } }),
      prisma.raporApproval.findMany({ where: { semester }, select: { classId: true } }),
    ]);

    const journalSet = new Set(recentJournals.map(j => `${j.teacherId}::${j.classId}::${j.subject}`));
    const missingJournal = assignments
      .filter(a => !journalSet.has(`${a.teacherId}::${a.classId}::${a.subject.name}`))
      .map(a => ({ teacherName: a.teacher.user.name, className: a.class.name, subject: a.subject.name }));

    // Nilai per kelas+mapel: siswa (aktif) yang sudah dinilai.
    const kelasSiswa = new Map(classes.map(c => [c.id, new Set(c.students.map(s => s.id))]));
    const kelasDari = new Map<string, string>();
    for (const c of classes) for (const s of c.students) kelasDari.set(s.id, c.id);
    const dinilai = new Map<string, number>();
    for (const g of grades) {
      if (g.avg === null) continue;
      const k = kelasDari.get(g.studentId);
      if (!k) continue;
      dinilai.set(`${k}|${g.subject}`, (dinilai.get(`${k}|${g.subject}`) ?? 0) + 1);
    }
    const kunciSet = new Set(kunci.map(k => k.classId)), sahSet = new Set(sah.map(k => k.classId));
    const progres = classes.filter(c => c.students.length).map(c => {
      const mapel = assignments.filter(a => a.classId === c.id);
      const lengkap = mapel.filter(a => (dinilai.get(`${c.id}|${a.subject.name}`) ?? 0) >= c.students.length).length;
      const sebagian = mapel.filter(a => (dinilai.get(`${c.id}|${a.subject.name}`) ?? 0) > 0).length;
      return {
        id: c.id, kelas: c.name, wali: c.homeroom?.user.name ?? null, siswa: c.students.length,
        mapel: mapel.length, lengkap, sebagian,
        status: sahSet.has(c.id) ? "DISAHKAN" : kunciSet.has(c.id) ? "DIKUNCI" : "TERBUKA",
      };
    });

    // Guru yang belum mengisi nilai sama sekali untuk sebagian penugasannya semester ini.
    const belumPerGuru = new Map<string, { nama: string; kelas: string[] }>();
    for (const a of assignments) {
      const siswa = kelasSiswa.get(a.classId)?.size ?? 0;
      if (!siswa || (dinilai.get(`${a.classId}|${a.subject.name}`) ?? 0) > 0) continue;
      const e = belumPerGuru.get(a.teacherId) ?? { nama: a.teacher.user.name, kelas: [] };
      e.kelas.push(`${a.class.name} ${a.subject.name}`);
      belumPerGuru.set(a.teacherId, e);
    }

    // Ketuntasan KKM per mapel.
    const kelasInfo = new Map(classes.map(c => [c.id, c]));
    const kkmCache = new Map<string, Awaited<ReturnType<typeof petaKkm>>>();
    const perMapel = new Map<string, { nilai: number[]; tuntas: number; kkm: Set<number> }>();
    for (const g of grades) {
      if (g.avg === null) continue;
      const c = kelasInfo.get(kelasDari.get(g.studentId) ?? "");
      if (!c) continue;
      const kk = `${c.grade}|${c.majorId}`;
      if (!kkmCache.has(kk)) kkmCache.set(kk, await petaKkm({ grade: c.grade, majorId: c.majorId }));
      const kkm = kkmCache.get(kk)!.kkmUntuk(g.subject);
      const e = perMapel.get(g.subject) ?? { nilai: [], tuntas: 0, kkm: new Set<number>() };
      e.nilai.push(g.avg); e.kkm.add(kkm);
      if (g.avg >= kkm) e.tuntas++;
      perMapel.set(g.subject, e);
    }
    const ketuntasan = [...perMapel.entries()].map(([mapel, e]) => ({
      mapel, dinilai: e.nilai.length, tuntas: e.tuntas, belumTuntas: e.nilai.length - e.tuntas,
      persenTuntas: Math.round((e.tuntas / e.nilai.length) * 100),
      rata: Math.round((e.nilai.reduce((a, b) => a + b, 0) / e.nilai.length) * 10) / 10,
      kkm: [...e.kkm].sort((a, b) => a - b).join("/"),
    })).sort((a, b) => a.persenTuntas - b.persenTuntas || a.mapel.localeCompare(b.mapel, "id"));

    // Beban JP per guru.
    const jpMengajar = new Map<string, number>();
    for (const a of assignments) jpMengajar.set(a.teacherId, (jpMengajar.get(a.teacherId) ?? 0) + a.subject.hoursPerWeek);
    const bebanJp = guru.map(t => {
      const ek = ekuivalensiJabatan(t.jabatan.map(j => j.jabatan.name), t._count.homeroomOf > 0);
      const mengajar = jpMengajar.get(t.id) ?? 0;
      return { nama: t.user.name, mengajar, ekuivalensi: ek.jp, rincian: ek.rincian, total: mengajar + ek.jp };
    }).sort((a, b) => a.total - b.total || a.nama.localeCompare(b.nama, "id"));

    const semuaNilai = grades.filter(g => g.avg !== null).map(g => g.avg as number);
    const totalDinilai = ketuntasan.reduce((a, k) => a + k.dinilai, 0);
    return Response.json({
      semester,
      schoolAvg: semuaNilai.length ? Math.round((semuaNilai.reduce((a, b) => a + b, 0) / semuaNilai.length) * 10) / 10 : null,
      persenTuntas: totalDinilai ? Math.round((ketuntasan.reduce((a, k) => a + k.tuntas, 0) / totalDinilai) * 100) : null,
      progres, guruBelumMenilai: [...belumPerGuru.values()].sort((a, b) => b.kelas.length - a.kelas.length),
      ketuntasan, bebanJp, syaratJp: SYARAT_JP,
      missingJournal,
      classesWithoutSchedule: classes.filter(c => c._count.schedules === 0).map(c => ({ id: c.id, name: c.name, grade: c.grade })),
      totalAssignments: assignments.length,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return Response.json({ error: "Data dashboard gagal dimuat." }, { status: 500 });
  }
}
