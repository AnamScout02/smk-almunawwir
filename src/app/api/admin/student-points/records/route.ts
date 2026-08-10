import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull, assertPiketOrKesiswaanBk } from "@/lib/kesiswaan-guard";

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isGanjil = month >= 7;
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return isGanjil ? `Ganjil ${tahunAjaran}` : `Genap ${tahunAjaran}`;
}

/** Riwayat poin — GET dibatasi Admin/Wakasek Kesiswaan/Guru BK saja (guru piket TIDAK bisa
 * lihat riwayat siapa pun, cuma boleh submit baru — lihat POST). Siswa lihat poin sendiri lewat
 * /api/student/points terpisah, bukan endpoint ini. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const semester = searchParams.get("semester");

    const records = await prisma.studentPointRecord.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(semester ? { semester } : {}),
        ...(classId ? { student: { classId } } : {}),
      },
      include: {
        student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
        violationType: { select: { name: true, category: true } },
        achievementType: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    });
    return Response.json(records);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPiketOrKesiswaanBk(session);

    const body = await req.json();
    const { studentId, kind, violationTypeId, achievementTypeId, points, note } = body as {
      studentId: string; kind: string; violationTypeId?: string; achievementTypeId?: string; points: number; note?: string;
    };
    if (!studentId || !kind || typeof points !== "number") {
      return Response.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Cek apakah pencatat ini "full access" (BK/Kesiswaan/Admin) atau cuma guru piket biasa.
    let hasFullAccess = true;
    try { await assertStudentPointsFull(session); } catch { hasFullAccess = false; }

    if (kind === "PELANGGARAN") {
      if (!violationTypeId) return Response.json({ error: "Jenis pelanggaran wajib dipilih" }, { status: 400 });
      const type = await prisma.studentViolationType.findUnique({ where: { id: violationTypeId } });
      if (!type || !type.active) return Response.json({ error: "Jenis pelanggaran tidak ditemukan" }, { status: 404 });
      if (!hasFullAccess && !type.piketAllowed) {
        return Response.json({ error: "Guru Piket cuma boleh mencatat Terlambat & seragam/atribut tidak sesuai ketentuan. Jenis pelanggaran lain khusus BK/Wakasek Kesiswaan." }, { status: 403 });
      }
      if (points < type.pointsMin || points > type.pointsMax) {
        return Response.json({ error: `Poin harus di antara ${type.pointsMin}-${type.pointsMax} utk jenis ini` }, { status: 400 });
      }
    } else if (kind === "PRESTASI") {
      if (!hasFullAccess) return Response.json({ error: "Pencatatan prestasi khusus BK/Wakasek Kesiswaan." }, { status: 403 });
      if (!achievementTypeId) return Response.json({ error: "Jenis prestasi wajib dipilih" }, { status: 400 });
      const type = await prisma.studentAchievementType.findUnique({ where: { id: achievementTypeId } });
      if (!type || !type.active) return Response.json({ error: "Jenis prestasi tidak ditemukan" }, { status: 404 });
      if (points < type.pointsMin || points > type.pointsMax) {
        return Response.json({ error: `Poin harus di antara ${type.pointsMin}-${type.pointsMax} utk jenis ini` }, { status: 400 });
      }
    } else if (kind === "REMISI") {
      // BAB V Tata Tertib: remisi HANYA berwenang Kepala Sekolah (akun ADMIN), walau usulan
      // bisa dari Wali Kelas/Guru BK/Wakasek Kesiswaan — makanya lebih ketat dari hasFullAccess.
      if (session.role !== "ADMIN") {
        return Response.json({ error: "Remisi cuma bisa diberikan oleh Kepala Sekolah (Admin), sesuai BAB V Tata Tertib." }, { status: 403 });
      }
      if (!note || !note.trim()) return Response.json({ error: "Alasan remisi wajib diisi" }, { status: 400 });
      if (points <= 0) return Response.json({ error: "Poin remisi harus lebih dari 0" }, { status: 400 });
    } else {
      return Response.json({ error: "kind harus PELANGGARAN, PRESTASI, atau REMISI" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "Siswa tidak ditemukan" }, { status: 404 });

    const record = await prisma.studentPointRecord.create({
      data: {
        studentId, kind,
        violationTypeId: kind === "PELANGGARAN" ? violationTypeId : null,
        achievementTypeId: kind === "PRESTASI" ? achievementTypeId : null,
        points, note: note?.trim() || null,
        semester: currentSemester(),
        recordedByName: session.name, recordedByRole: session.role,
      },
    });
    return Response.json(record, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Anda tidak berhak mencatat poin (bukan piket hari ini/BK/Wakasek Kesiswaan)." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan catatan poin" }, { status: 500 });
  }
}
