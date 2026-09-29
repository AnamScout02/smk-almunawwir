import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { kirimLatar } from "@/lib/push-server";
import { beritahuAlphaBeruntun, beritahuOrangTuaAlpha } from "@/lib/notifikasi-kejadian";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

// Absensi resmi KHUSUS wali kelas utk INPUT (per keputusan terbaru, membalik kebijakan lama) —
// guru mapel biasa yang cuma punya TeachingAssignment (bukan wali kelas) TIDAK lagi boleh input
// di sini. Kalau guru mapel perlu catat kehadiran per pertemuan mapelnya sendiri, itu lewat kolom
// Kehadiran di Jurnal Mengajar (JournalEntry.attendanceStatus, terpisah & tidak menimpa tabel ini).
async function getHomeroomClassIds(session: { role: string; email: string }): Promise<string[] | null> {
  if (session.role !== "TEACHER") return null;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: { homeroomOf: { select: { id: true } } },
  });
  return teacher?.homeroomOf.map(c => c.id) ?? [];
}

// Utk MELIHAT (GET) rekap, Wakil Kepala Kesiswaan & Guru BK juga boleh akses SEMUA kelas (bukan
// cuma kelas wali) — beda dari POST (input/ubah) di bawah yang TETAP pakai getHomeroomClassIds,
// khusus wali kelas. Lihat src/lib/kesiswaan-guard.ts.
async function getReadAllowedClassIds(session: { role: string; email: string }): Promise<string[] | null> {
  if (session.role === "TEACHER") {
    const names = await getJabatanNames(session.email);
    if (KESISWAAN_BK_JABATAN.some(n => names.includes(n))) return null;
  }
  return getHomeroomClassIds(session);
}

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    const allowedClassIds = await getReadAllowedClassIds(session);
    if (allowedClassIds !== null) {
      if (classId && !allowedClassIds.includes(classId)) {
        return Response.json({ error: "Anda tidak memiliki akses ke kelas ini" }, { status: 403 });
      }
      if (!classId && allowedClassIds.length === 0) return Response.json([]);
    }

    const where: Record<string, unknown> = {};
    if (classId) where.student = { classId };
    else if (allowedClassIds) where.student = { classId: { in: allowedClassIds } };
    if (date) where.date = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };

    const records = await prisma.attendance.findMany({
      where,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    });
    return Response.json(records);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { records } = await req.json();

    type AttRecord = { studentId: string; date: string; status: string };
    const list = records as AttRecord[];

    const allowedClassIds = await getHomeroomClassIds(session);
    if (allowedClassIds !== null) {
      const studentIds = [...new Set(list.map(r => r.studentId))];
      const validCount = await prisma.student.count({
        where: { id: { in: studentIds }, classId: { in: allowedClassIds } },
      });
      if (validCount !== studentIds.length) {
        return Response.json({ error: "Anda tidak memiliki akses ke sebagian siswa ini" }, { status: 403 });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const r of list) {
        const date = new Date(r.date);
        const nextDay = new Date(date.getTime() + 86400000);
        await tx.attendance.deleteMany({
          where: { studentId: r.studentId, date: { gte: date, lt: nextDay } },
        });
        await tx.attendance.create({
          data: { studentId: r.studentId, date, status: r.status },
        });
      }
    });

    // ALPHA → notifikasi orang tua; alpha ≥3 hari beruntun → wali kelas & BK. Tanpa menunggu, tidak menggagalkan simpan.
    kirimLatar(async () => { await beritahuOrangTuaAlpha(list); await beritahuAlphaBeruntun(list); });

    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
