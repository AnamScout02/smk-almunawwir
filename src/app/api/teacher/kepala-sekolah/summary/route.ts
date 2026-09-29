import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJournalGradeAggregates } from "@/lib/journal-grades";
import { bagianWib } from "@/lib/waktu-wib";
import { cekLibur } from "@/lib/hari-libur";
import { getClassesMissingAttendance } from "@/lib/attendance-gaps";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { hitungRisikoSiswa } from "@/lib/peringatan-dini";
import { petaKkm } from "@/lib/kkm";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** DASHBOARD EKSEKUTIF KEPALA SEKOLAH (diperkaya 17 Sep 2026): kondisi HARI INI (kehadiran siswa & guru, kelas belum absen,
 * jurnal, ujian, izin), antrean keputusan, siswa berisiko, tren 6 bulan, dan perbandingan per jurusan. Semua "hari ini" di WIB. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    if (session.role !== "ADMIN") {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
      });
      if (!teacher?.jabatan.some(j => j.jabatan.name === "Kepala Sekolah")) return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }

    const now = new Date();
    const w = bagianWib(now);
    const awalHari = new Date(`${w.iso}T00:00:00Z`);
    const akhirHari = new Date(awalHari.getTime() + 86400000);
    const semesters = semesterRapor();
    const semester = semesters[w.bulan >= 7 ? 2 : 3];
    const since30 = new Date(awalHari.getTime() - 30 * 86400000);
    const awal6Bulan = new Date(Date.UTC(w.tahun, w.bulan - 6, 1));

    const [libur, siswaAktif, absenHariIni, kelasBelum, guruHariIni, jurnalHariIni, ujian, izinMenunggu, kunci, sah, mouAkhir,
      absen30, absen6, poin6, internships, risiko, grades] = await Promise.all([
      cekLibur(w.iso),
      prisma.student.findMany({ where: { studentStatus: "AKTIF", classId: { not: null } }, select: { id: true, majorId: true, class: { select: { grade: true } }, major: { select: { name: true, code: true } } } }),
      prisma.attendance.groupBy({ by: ["status"], where: { date: { gte: awalHari, lt: akhirHari } }, _count: true }),
      getClassesMissingAttendance(awalHari),
      prisma.teacherScheduleAttendance.groupBy({ by: ["status"], where: { date: { gte: awalHari, lt: akhirHari } }, _count: true }),
      prisma.teachingJournal.count({ where: { date: { gte: awalHari, lt: akhirHari } } }),
      prisma.exam.count({ where: { isPublished: true, startTime: { lte: now }, endTime: { gt: now } } }),
      prisma.izinSiswa.count({ where: { status: "MENUNGGU" } }),
      prisma.raporKunci.findMany({ where: { semester: { in: semesters } }, select: { classId: true, semester: true } }),
      prisma.raporApproval.findMany({ where: { semester: { in: semesters } }, select: { classId: true, semester: true } }),
      prisma.industryPartner.count({ where: { mouEndDate: { gte: now, lte: new Date(now.getTime() + 60 * 86400000) } } }),
      prisma.attendance.findMany({ where: { date: { gte: since30 } }, select: { status: true, student: { select: { majorId: true } } } }),
      prisma.attendance.findMany({ where: { date: { gte: awal6Bulan } }, select: { date: true, status: true } }),
      prisma.studentPointRecord.findMany({ where: { kind: "PELANGGARAN", date: { gte: awal6Bulan } }, select: { date: true, student: { select: { majorId: true } } } }),
      prisma.internship.findMany({ select: { status: true, company: true } }),
      hitungRisikoSiswa({ now }).catch(() => null),
      getJournalGradeAggregates({ semester }),
    ]);

    // Jadwal mengajar hari ini (untuk perbandingan dengan jurnal yang terisi).
    let jadwalHariIni = 0;
    if (!libur) {
      const minggu = await getWeekTypeForDate(awalHari);
      const jadwal = await prisma.schedule.findMany({ where: { day: HARI[w.hariKe], scheduleType: "BLOK" }, select: { classId: true, subject: true, teacherId: true, weekType: true } });
      jadwalHariIni = new Set(jadwal.filter(j => weekTypesOverlap(j.weekType, minggu)).map(j => `${j.teacherId}|${j.classId}|${j.subject}`)).size;
    }
    const hitung = (arr: { status: string; _count: number }[], st: string) => arr.find(a => a.status === st)?._count ?? 0;
    const tercatat = absenHariIni.reduce((a, x) => a + x._count, 0);
    const guruTercatat = guruHariIni.reduce((a, x) => a + x._count, 0);
    const sahSet = new Set(sah.map(x => `${x.classId}|${x.semester}`));

    // Tren 6 bulan (kehadiran % & jumlah pelanggaran per bulan).
    const bulanTren = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(w.tahun, w.bulan - 6 + i, 1));
      return { kunci: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: `${BULAN[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, hadir: 0, total: 0, pelanggaran: 0 };
    });
    const perBulan = new Map(bulanTren.map(b => [b.kunci, b]));
    for (const a of absen6) {
      const b = perBulan.get(`${a.date.getUTCFullYear()}-${a.date.getUTCMonth()}`);
      if (b) { b.total++; if (a.status === "HADIR") b.hadir++; }
    }
    for (const p of poin6) {
      const b = perBulan.get(`${p.date.getUTCFullYear()}-${p.date.getUTCMonth()}`);
      if (b) b.pelanggaran++;
    }

    // Per jurusan: siswa aktif, kehadiran 30 hari, rata-rata nilai & ketuntasan KKM semester berjalan, pelanggaran 30 hari.
    const jurusan = new Map<string, { nama: string; kode: string; siswa: number; hadir: number; absen: number; nilai: number[]; tuntas: number; dinilai: number; pelanggaran: number }>();
    const jurusanSiswa = new Map<string, string>();
    for (const s of siswaAktif) {
      jurusanSiswa.set(s.id, s.majorId);
      const j = jurusan.get(s.majorId) ?? { nama: s.major.name, kode: s.major.code, siswa: 0, hadir: 0, absen: 0, nilai: [], tuntas: 0, dinilai: 0, pelanggaran: 0 };
      j.siswa++;
      jurusan.set(s.majorId, j);
    }
    for (const a of absen30) {
      const j = a.student.majorId ? jurusan.get(a.student.majorId) : undefined;
      if (j) { j.absen++; if (a.status === "HADIR") j.hadir++; }
    }
    const since30Poin = poin6.filter(p => p.date >= since30);
    for (const p of since30Poin) { const j = p.student.majorId ? jurusan.get(p.student.majorId) : undefined; if (j) j.pelanggaran++; }
    const petaSiswa = new Map(siswaAktif.map(s => [s.id, s]));
    const kkmCache = new Map<string, Awaited<ReturnType<typeof petaKkm>>>();
    for (const g of grades) {
      if (g.avg === null) continue;
      const s = petaSiswa.get(g.studentId);
      const j = s ? jurusan.get(s.majorId) : undefined;
      if (!s || !j) continue;
      const kunciKkm = `${s.class?.grade}|${s.majorId}`;
      if (!kkmCache.has(kunciKkm)) kkmCache.set(kunciKkm, await petaKkm({ grade: s.class?.grade, majorId: s.majorId }));
      j.nilai.push(g.avg);
      j.dinilai++;
      if (g.avg >= kkmCache.get(kunciKkm)!.kkmUntuk(g.subject)) j.tuntas++;
    }

    const companyCounts = new Map<string, number>();
    for (const i of internships) companyCounts.set(i.company, (companyCounts.get(i.company) ?? 0) + 1);

    return Response.json({
      semester,
      hariIni: {
        tanggal: w.iso, libur: libur?.nama ?? null,
        siswaAktif: siswaAktif.length, tercatat,
        hadir: hitung(absenHariIni, "HADIR"), izin: hitung(absenHariIni, "IZIN"), sakit: hitung(absenHariIni, "SAKIT"), alpha: hitung(absenHariIni, "ALPHA"),
        persenHadir: persen(hitung(absenHariIni, "HADIR"), tercatat),
        kelasBelumAbsen: kelasBelum.map(k => k.name),
        guruTercatat, guruTidakHadir: guruTercatat - hitung(guruHariIni, "HADIR") - hitung(guruHariIni, "TERLAMBAT"), guruTerlambat: hitung(guruHariIni, "TERLAMBAT"),
        jadwal: jadwalHariIni, jurnal: jurnalHariIni, ujianBerlangsung: ujian, izinMenunggu,
      },
      keputusan: {
        raporSiapSah: kunci.filter(k => !sahSet.has(`${k.classId}|${k.semester}`)).length,
        mouAkanBerakhir: mouAkhir,
      },
      risiko: risiko ? { ...risiko.ringkas, total: risiko.baris.length } : null,
      tren: bulanTren.map(b => ({ label: b.label, persenHadir: persen(b.hadir, b.total), pelanggaran: b.pelanggaran })),
      perJurusan: [...jurusan.values()].map(j => ({
        nama: j.nama, kode: j.kode, siswa: j.siswa, persenHadir: persen(j.hadir, j.absen),
        rataNilai: j.nilai.length ? Math.round((j.nilai.reduce((a, b) => a + b, 0) / j.nilai.length) * 10) / 10 : null,
        persenTuntas: persen(j.tuntas, j.dinilai), pelanggaran: j.pelanggaran,
      })).sort((a, b) => a.kode.localeCompare(b.kode)),
      pklByStatus: {
        ONGOING: internships.filter(i => i.status === "ONGOING").length,
        COMPLETED: internships.filter(i => i.status === "COMPLETED").length,
        CANCELLED: internships.filter(i => i.status === "CANCELLED").length,
      },
      topCompanies: [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([company, count]) => ({ company, count })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Data dashboard gagal dimuat." }, { status: 500 });
  }
}
