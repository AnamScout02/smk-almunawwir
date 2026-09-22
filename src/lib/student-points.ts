import "server-only";
import { prisma } from "@/lib/prisma";
import { bagianWib } from "@/lib/waktu-wib";

function currentSemester(): string {
  const now = new Date();
  const { tahun: year, bulan: month } = bagianWib(now); // WIB, bukan jam server (UTC)
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

/** Ringkasan poin pelanggaran/prestasi/remisi semester berjalan untuk SATU siswa — akumulasi
 * poin sesuai Pasal 7 Tata Tertib Peserta Didik. Diekstrak dari /api/student/points (dulu inline
 * di sana) supaya dipakai ulang oleh Portal Orang Tua tanpa duplikasi logic mekanisme sanksi. */
export async function computeStudentPointsSummary(studentId: string) {
  const semester = currentSemester();
  const records = await prisma.studentPointRecord.findMany({
    where: { studentId, semester },
    include: {
      violationType: { select: { name: true, category: true } },
      achievementType: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const totalPelanggaran = records.filter(r => r.kind === "PELANGGARAN").reduce((a, r) => a + r.points, 0);
  const totalPrestasi = records.filter(r => r.kind === "PRESTASI").reduce((a, r) => a + r.points, 0);
  const totalRemisi = records.filter(r => r.kind === "REMISI").reduce((a, r) => a + r.points, 0);
  const netPoints = Math.max(0, totalPelanggaran - totalPrestasi - totalRemisi);

  // Mekanisme sanksi poin — BAB VII Pasal 7 ayat 9 Tata Tertib.
  let level: string, levelDesc: string;
  if (netPoints < 25) { level = "Aman"; levelDesc = "Belum ada tindakan formal."; }
  else if (netPoints <= 50) { level = "Surat Peringatan 1"; levelDesc = "Pembinaan bersama orang tua oleh Guru BK & Wakasek Kesiswaan."; }
  else if (netPoints <= 75) { level = "Surat Peringatan 2"; levelDesc = "Skorsing 1 hari atau wajib lapor 1 minggu kepada Guru BK."; }
  else if (netPoints <= 99) { level = "Surat Peringatan 3"; levelDesc = "Skorsing 3 hari atau wajib lapor 2 minggu, pernyataan kembali ke orang tua."; }
  else { level = "Dikembalikan ke Orang Tua"; levelDesc = "Poin mencapai batas maksimal 100."; }

  return { semester, totalPelanggaran, totalPrestasi, totalRemisi, netPoints, level, levelDesc, records };
}
