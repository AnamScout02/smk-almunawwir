import { prisma } from "@/lib/prisma";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, tenggat, type Jejak } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** JEJAK AKTIVITAS satu siswa pada satu ujian (audit trail) — bukti bila ada sanggahan:
 * kapan mulai, membuka ulang halaman, pindah/ditolak perangkat, terputus & tersambung lagi,
 * pelanggaran (pindah tab, salin, Print Screen), tindakan pengawas, dan kapan mengumpulkan.
 * Catatan pelanggaran disimpan terpisah sejak awal, di sini digabung jadi satu garis waktu. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
    const a = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: id, studentId } },
      include: { student: { select: { nis: true, classId: true, user: { select: { name: true } } } } },
    });
    if (!a) return Response.json({ error: "Siswa ini belum pernah membuka ujian." }, { status: 404 });

    const jejak = (Array.isArray(a.jejak) ? (a.jejak as unknown as Jejak[]) : []);
    const pelanggaran = (Array.isArray(a.pelanggaran) ? (a.pelanggaran as { jenis: string; waktu: string }[]) : [])
      .map(p => ({ jenis: p.jenis, waktu: p.waktu, pelanggaran: true }));
    const garis = [...jejak.map(j => ({ ...j, pelanggaran: false })), ...pelanggaran]
      .sort((x, y) => x.waktu.localeCompare(y.waktu));

    return Response.json({
      student: { nis: a.student.nis, user: a.student.user }, startedAt: a.startedAt, submittedAt: a.submittedAt, lastSeenAt: a.lastSeenAt,
      tenggat: tenggat(a.startedAt, exam.duration, jendelaKelas(exam, a.student.classId).endTime, a.tambahanMenit),
      tambahanMenit: a.tambahanMenit, terkunci: a.terkunci, alasanKunci: a.alasanKunci,
      perangkat: a.perangkatId ? `…${a.perangkatId.slice(-6)}` : null,
      garis,
    });
  } catch {
    return Response.json({ error: "Gagal memuat jejak." }, { status: 500 });
  }
}
