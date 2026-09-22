import "server-only";
import { prisma } from "@/lib/prisma";
import { bagianWib } from "@/lib/waktu-wib";

/** KELENGKAPAN PERANGKAT AJAR (21 September 2026).
 *
 * Satu baris = satu pasangan GURU × MAPEL × TINGKAT yang benar-benar diampu (dari Penugasan
 * Mengajar), untuk semester berjalan. Tiap baris diperiksa terhadap tiga perangkat yang sudah
 * punya tempat di sistem:
 *
 *   Prota & Promes   RencanaAjar (tahunAjaran "2026/2027" + semester "GANJIL")
 *   RPP / Modul Ajar LessonPlan  (semester "Ganjil 2026/2027" — kosong dianggap berlaku)
 *   Jurnal Mengajar  TeachingJournal pada kelas-kelas tingkat itu, semester yang sama
 *
 * "Lengkap" = Prota/Promes ADA dan minimal satu RPP. Jurnal DITAMPILKAN sebagai bukti
 * pelaksanaan, tetapi tidak ikut syarat lengkap — jurnal bertambah tiap pertemuan, bukan dokumen
 * yang disiapkan di awal semester.
 *
 * Dua format semester berbeda di dua tabel lama itu memang begitu adanya; berkas ini yang
 * menjembatani, supaya halaman tidak perlu tahu. */

export interface SemesterAktif { label: string; tahunAjaran: string; semester: "GANJIL" | "GENAP" }

/** Semester berjalan dihitung di WIB (server berjalan UTC — CLAUDE.md #42). Juli+ = Ganjil tahun baru. */
export function semesterAktif(): SemesterAktif {
  const { tahun, bulan } = bagianWib();
  const ganjil = bulan >= 7;
  const tahunAjaran = ganjil ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`;
  return { label: `${ganjil ? "Ganjil" : "Genap"} ${tahunAjaran}`, tahunAjaran, semester: ganjil ? "GANJIL" : "GENAP" };
}

export interface BarisKelengkapan {
  teacherId: string; guru: string; nip: string | null;
  mapel: string; tingkat: number; kelas: string[];
  prota: boolean; rpp: number; jurnal: number;
  lengkap: boolean;
}

export async function susunKelengkapan(opsi: { teacherId?: string } = {}): Promise<{ semester: SemesterAktif; baris: BarisKelengkapan[] }> {
  const sem = semesterAktif();
  const penugasan = await prisma.teachingAssignment.findMany({
    where: opsi.teacherId ? { teacherId: opsi.teacherId } : {},
    select: {
      teacherId: true, subjectId: true,
      subject: { select: { name: true } },
      class: { select: { id: true, name: true, grade: true } },
      teacher: { select: { nip: true, teacherStatus: true, user: { select: { name: true } } } },
    },
  });

  // Satukan per guru × mapel × tingkat (satu Prota berlaku untuk semua rombel setingkat).
  const kelompok = new Map<string, {
    teacherId: string; subjectId: string; guru: string; nip: string | null; mapel: string; tingkat: number;
    kelasIds: string[]; kelas: string[];
  }>();
  for (const t of penugasan) {
    if (t.teacher.teacherStatus && t.teacher.teacherStatus !== "AKTIF") continue;
    const k = `${t.teacherId}|${t.subjectId}|${t.class.grade}`;
    const ada = kelompok.get(k) ?? {
      teacherId: t.teacherId, subjectId: t.subjectId, guru: t.teacher.user.name, nip: t.teacher.nip,
      mapel: t.subject.name, tingkat: t.class.grade, kelasIds: [], kelas: [],
    };
    ada.kelasIds.push(t.class.id); ada.kelas.push(t.class.name);
    kelompok.set(k, ada);
  }
  const daftar = [...kelompok.values()];
  const guruIds = [...new Set(daftar.map(d => d.teacherId))];

  const [prota, rpp, jurnal] = await Promise.all([
    prisma.rencanaAjar.findMany({
      where: { teacherId: { in: guruIds }, tahunAjaran: sem.tahunAjaran, semester: sem.semester },
      select: { teacherId: true, subject: true, tingkat: true },
    }),
    prisma.lessonPlan.findMany({
      where: { teacherId: { in: guruIds }, OR: [{ semester: sem.label }, { semester: null }] },
      select: { teacherId: true, subjectId: true, grade: true },
    }),
    prisma.teachingJournal.findMany({
      where: { teacherId: { in: guruIds }, semester: sem.label },
      select: { teacherId: true, subject: true, classId: true },
    }),
  ]);

  const setProta = new Set(prota.map(p => `${p.teacherId}|${p.subject}|${p.tingkat}`));
  const baris: BarisKelengkapan[] = daftar.map(d => {
    const nRpp = rpp.filter(r => r.teacherId === d.teacherId && r.subjectId === d.subjectId && (r.grade === null || r.grade === d.tingkat)).length;
    const nJurnal = jurnal.filter(j => j.teacherId === d.teacherId && j.subject === d.mapel && d.kelasIds.includes(j.classId)).length;
    const adaProta = setProta.has(`${d.teacherId}|${d.mapel}|${d.tingkat}`);
    return {
      teacherId: d.teacherId, guru: d.guru, nip: d.nip, mapel: d.mapel, tingkat: d.tingkat,
      kelas: d.kelas.sort(), prota: adaProta, rpp: nRpp, jurnal: nJurnal,
      lengkap: adaProta && nRpp > 0,
    };
  });
  baris.sort((a, b) => a.guru.localeCompare(b.guru) || a.mapel.localeCompare(b.mapel) || a.tingkat - b.tingkat);
  return { semester: sem, baris };
}
