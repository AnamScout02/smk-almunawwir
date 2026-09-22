import "server-only";
import { prisma } from "@/lib/prisma";
import { getJournalGradeAggregates } from "@/lib/journal-grades";
import { petaKkm } from "@/lib/kkm";
import { levelPoin } from "@/lib/peringatan-dini";
import { rentangSemester } from "@/lib/rapor-verifikasi";

/** CATATAN WALI KELAS untuk rapor (17 Sep 2026): data ringkas per siswa + SARAN kalimat otomatis (wali kelas tinggal menyunting). */
export async function dataCatatanWali(classId: string, semester: string) {
  const kelas = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      name: true, grade: true, majorId: true,
      students: { where: { studentStatus: "AKTIF" }, select: { id: true, nis: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } },
    },
  });
  if (!kelas) return null;
  const ids = kelas.students.map(s => s.id);
  const r = rentangSemester(semester);
  const [catatan, absen, poin, nilai, kkm] = await Promise.all([
    prisma.catatanWaliKelas.findMany({ where: { studentId: { in: ids }, semester } }),
    r ? prisma.attendance.findMany({ where: { studentId: { in: ids }, date: { gte: r.mulai, lt: r.akhir } }, select: { studentId: true, status: true } }) : [],
    prisma.studentPointRecord.findMany({ where: { studentId: { in: ids }, semester }, select: { studentId: true, kind: true, points: true } }),
    getJournalGradeAggregates({ studentIds: ids, semester }),
    petaKkm({ grade: kelas.grade, majorId: kelas.majorId }),
  ]);
  const perCatatan = new Map(catatan.map(c => [c.studentId, c]));
  return {
    kelas: kelas.name,
    siswa: kelas.students.map(s => {
      const a = absen.filter(x => x.studentId === s.id);
      const hadir = a.filter(x => x.status === "HADIR").length;
      const persenHadir = a.length ? Math.round((hadir / a.length) * 100) : null;
      const alpha = a.filter(x => x.status === "ALPHA").length;
      const p = poin.filter(x => x.studentId === s.id);
      const total = (k: string) => p.filter(x => x.kind === k).reduce((acc, x) => acc + x.points, 0);
      const poinBersih = Math.max(0, total("PELANGGARAN") - total("PRESTASI") - total("REMISI"));
      const prestasi = p.filter(x => x.kind === "PRESTASI").length;
      const n = nilai.filter(g => g.studentId === s.id && g.avg !== null);
      const rata = n.length ? Math.round((n.reduce((acc, g) => acc + (g.avg ?? 0), 0) / n.length) * 10) / 10 : null;
      const belumTuntas = n.filter(g => (g.avg ?? 0) < kkm.kkmUntuk(g.subject)).map(g => g.subject);
      const nama = s.user.name.split(" ")[0];
      const bagian: string[] = [];
      if (persenHadir !== null) {
        bagian.push(persenHadir >= 95 ? `${nama} sangat rajin hadir (${persenHadir}%).`
          : persenHadir >= 85 ? `Kehadiran ${nama} baik (${persenHadir}%).`
          : `Kehadiran ${nama} perlu ditingkatkan (${persenHadir}%${alpha ? `, ${alpha} kali tanpa keterangan` : ""}).`);
      }
      if (rata !== null) {
        bagian.push(belumTuntas.length
          ? `Rata-rata nilai ${rata}; perlu memperbaiki ${belumTuntas.slice(0, 3).join(", ")}${belumTuntas.length > 3 ? " dan mapel lainnya" : ""} yang belum mencapai KKM.`
          : rata >= 85 ? `Capaian belajar sangat baik dengan rata-rata ${rata}; pertahankan.` : `Seluruh mapel tuntas dengan rata-rata ${rata}; terus tingkatkan.`);
      }
      const level = levelPoin(poinBersih);
      bagian.push(level === "Aman" ? (prestasi ? `Sikap dan kedisiplinan baik serta berprestasi.` : `Sikap dan kedisiplinan baik.`)
        : `Kedisiplinan perlu perhatian (${level}); mohon dukungan orang tua dalam pembinaan.`);
      const c = perCatatan.get(s.id);
      return {
        studentId: s.id, nis: s.nis, nama: s.user.name, persenHadir, alpha, rata, belumTuntas: belumTuntas.length, poinBersih, level,
        catatan: c?.catatan ?? "", diperbarui: c?.updatedAt ?? null, saran: bagian.join(" "),
      };
    }),
  };
}
