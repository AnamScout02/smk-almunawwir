import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";
import { bagianWib } from "@/lib/waktu-wib";

function currentSemester(): string {
  const now = new Date();
  const { tahun: year, bulan: month } = bagianWib(now); // WIB, bukan jam server (UTC)
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

function levelFor(netPoints: number): string {
  if (netPoints < 25) return "Aman";
  if (netPoints <= 50) return "Surat Peringatan 1";
  if (netPoints <= 75) return "Surat Peringatan 2";
  if (netPoints <= 99) return "Surat Peringatan 3";
  return "Dikembalikan ke Orang Tua";
}

/** Daftar siswa yang poin bersihnya sudah menyentuh ambang sanksi (>=25, BAB VII ayat 9 Tata
 * Tertib) semester berjalan — biar BK/Wakasek Kesiswaan proaktif, tidak perlu cek Riwayat satu
 * per satu. Sama seperti /api/admin/student-points/records, khusus full-access (bukan piket). */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);

    const semester = currentSemester();
    const records = await prisma.studentPointRecord.findMany({
      where: { semester },
      select: {
        studentId: true, kind: true, points: true,
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
      },
    });

    const agg = new Map<string, { nis: string; name: string; className: string | null; pelanggaran: number; prestasi: number; remisi: number }>();
    for (const r of records) {
      const cur = agg.get(r.studentId) ?? { nis: r.student.nis, name: r.student.user.name, className: r.student.class?.name ?? null, pelanggaran: 0, prestasi: 0, remisi: 0 };
      if (r.kind === "PELANGGARAN") cur.pelanggaran += r.points;
      else if (r.kind === "PRESTASI") cur.prestasi += r.points;
      else if (r.kind === "REMISI") cur.remisi += r.points;
      agg.set(r.studentId, cur);
    }

    const students = Array.from(agg.entries())
      .map(([studentId, v]) => {
        const netPoints = Math.max(0, v.pelanggaran - v.prestasi - v.remisi);
        return { studentId, nis: v.nis, name: v.name, className: v.className, netPoints, level: levelFor(netPoints) };
      })
      .filter(s => s.netPoints >= 25)
      .sort((a, b) => b.netPoints - a.netPoints);

    return Response.json({ semester, students });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
