import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { NextRequest } from "next/server";

const STATUS_LETTER: Record<string, string> = { HADIR: "H", IZIN: "I", SAKIT: "S", ALPHA: "A" };

// Grid absensi 1 bulan penuh per siswa (kolom = tanggal 1..akhir bulan) — dipakai tab "Kalender
// Bulanan" di AbsensiSiswaManager (mirip absensi kertas manual tapi hidup dari data digital yang
// sudah diinput wali kelas). Guard sama persis pola /api/teacher/attendance/summary.
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const classId = req.nextUrl.searchParams.get("classId");
    const monthParam = req.nextUrl.searchParams.get("month");
    const now = new Date();
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dateFilter = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };

    let targetClassId: string;
    // Wakasek Kesiswaan & Guru BK boleh lihat kelas manapun (bukan cuma kelas wali) — sama seperti
    // ADMIN, wajib kirim classId eksplisit. Lihat src/lib/kesiswaan-guard.ts.
    const isKesiswaanOrBk = session.role === "TEACHER" && (await getJabatanNames(session.email)).some(n => KESISWAAN_BK_JABATAN.includes(n));
    if (session.role === "TEACHER" && !isKesiswaanOrBk) {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        include: { homeroomOf: { select: { id: true } } },
      });
      const allowedClassIds = teacher?.homeroomOf.map(c => c.id) ?? [];
      if (allowedClassIds.length === 0) return Response.json({ error: "Anda bukan wali kelas" }, { status: 403 });
      targetClassId = classId && allowedClassIds.includes(classId) ? classId : allowedClassIds[0];
    } else {
      // ADMIN & Kesiswaan/BK tidak terikat kelas wali — bebas lihat kelas manapun, wajib kirim classId eksplisit.
      if (!classId) return Response.json({ error: "classId wajib diisi" }, { status: 400 });
      targetClassId = classId;
    }

    const students = await prisma.student.findMany({
      where: { classId: targetClassId, studentStatus: "AKTIF" },
      include: {
        user: { select: { name: true } },
        attendance: { where: { date: dateFilter } },
      },
      orderBy: { user: { name: "asc" } },
    });

    const sundays: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) sundays.push(d);
    }

    const result = students.map(s => {
      const cells: Record<number, string> = {};
      for (const a of s.attendance) {
        const day = new Date(a.date).getUTCDate();
        cells[day] = STATUS_LETTER[a.status] ?? "";
      }
      return {
        id: s.id,
        nis: s.nis,
        name: s.user.name,
        cells,
        SAKIT: s.attendance.filter(a => a.status === "SAKIT").length,
        IZIN: s.attendance.filter(a => a.status === "IZIN").length,
        ALPHA: s.attendance.filter(a => a.status === "ALPHA").length,
      };
    });

    return Response.json({ classId: targetClassId, month, daysInMonth, sundays, students: result });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
