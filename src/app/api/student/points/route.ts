import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

/** Poin pelanggaran/prestasi MILIK SENDIRI — read-only, sesuai Pasal 7 Tata Tertib (akumulasi
 * poin pelanggaran per tahun ajaran, dikurangi poin prestasi). Siswa cuma lihat punya sendiri,
 * tidak bisa lihat siswa lain (beda dgn /api/admin/student-points/records yg khusus BK/Kesiswaan). */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    if (!student) return Response.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });

    const semester = currentSemester();
    const records = await prisma.studentPointRecord.findMany({
      where: { studentId: student.id, semester },
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

    return Response.json({ semester, totalPelanggaran, totalPrestasi, totalRemisi, netPoints, level, levelDesc, records });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
