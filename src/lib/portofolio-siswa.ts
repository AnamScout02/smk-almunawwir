import "server-only";
import { prisma } from "@/lib/prisma";
import { susunRaporSiswa } from "@/lib/rapor-data";

/** E-PORTOFOLIO SISWA (18 Sep 2026) — rangkuman prestasi, ekstrakurikuler, PKL, dan capaian nilai
 * untuk ditampilkan di portal siswa dan dicetak sebagai CV/portofolio. */
export async function portofolioSiswa(studentId: string) {
  const siswa = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, nis: true, nisn: true, classId: true, majorId: true, birthPlace: true, birthDate: true, address: true,
      verificationToken: true, bukuIndukData: true,
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
  });
  if (!siswa) return null;
  const [prestasi, anggotaEkstra, nilaiEkstra, pkl, rapor] = await Promise.all([
    prisma.studentPointRecord.findMany({
      where: { studentId, kind: "PRESTASI" }, orderBy: { date: "desc" }, take: 50,
      select: { id: true, date: true, note: true, points: true, sertifikatToken: true, achievementType: { select: { name: true } } },
    }),
    prisma.extracurricularMember.findMany({ where: { studentId }, select: { role: true, extracurricularId: true, sertifikatToken: true, extracurricular: { select: { name: true } } } }),
    prisma.nilaiEkstra.findMany({ where: { studentId }, orderBy: { semester: "desc" } }),
    prisma.internship.findUnique({ where: { studentId }, select: { company: true, position: true, startDate: true, endDate: true, status: true, nilaiIndustriRata: true, sertifikatToken: true } }),
    susunRaporSiswa({ id: studentId, classId: siswa.classId, majorId: siswa.majorId, grade: siswa.class?.grade ?? null }).catch(() => []),
  ]);
  const bi = (siswa.bukuIndukData ?? {}) as Record<string, unknown>;
  return {
    siswa: {
      nama: siswa.user.name, nis: siswa.nis, nisn: siswa.nisn, kelas: siswa.class?.name ?? "-", jurusan: siswa.major?.name ?? "-",
      email: siswa.user.email, tempatLahir: siswa.birthPlace, tanggalLahir: siswa.birthDate, alamat: siswa.address,
      hp: typeof bi.studentPhone === "string" ? bi.studentPhone : "", verificationToken: siswa.verificationToken,
    },
    prestasi: prestasi.map(p => ({ id: p.id, tanggal: p.date, jenis: p.achievementType?.name ?? "Prestasi", catatan: p.note, poin: p.points, bersertifikat: !!p.sertifikatToken })),
    ekstra: anggotaEkstra.map(a => ({
      nama: a.extracurricular.name, peran: a.role, bersertifikat: !!a.sertifikatToken,
      predikat: nilaiEkstra.find(n => n.extracurricularId === a.extracurricularId)?.predikat ?? null,
      semester: nilaiEkstra.find(n => n.extracurricularId === a.extracurricularId)?.semester ?? null,
    })),
    pkl,
    rapor: rapor.filter(r => r.disahkan).map(r => ({ semester: r.sem, rata: r.semAvg, jumlahMapel: r.rows.length })),
  };
}
