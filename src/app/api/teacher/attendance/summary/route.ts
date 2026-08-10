import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const classId = req.nextUrl.searchParams.get("classId");
    const month = req.nextUrl.searchParams.get("month"); // format opsional: "2026-08" — kosong = rekap sepanjang waktu (perilaku lama)
    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      dateFilter = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

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
      if (allowedClassIds.length === 0) return Response.json([]);
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
        attendance: dateFilter ? { where: { date: dateFilter } } : true,
      },
      orderBy: { user: { name: "asc" } },
    });

    const summary = students.map(s => {
      const att = s.attendance;
      return {
        id: s.id,
        nis: s.nis,
        name: s.user.name,
        total: att.length,
        HADIR: att.filter(a => a.status === "HADIR").length,
        IZIN: att.filter(a => a.status === "IZIN").length,
        SAKIT: att.filter(a => a.status === "SAKIT").length,
        ALPHA: att.filter(a => a.status === "ALPHA").length,
        pct: att.length
          ? Math.round((att.filter(a => a.status === "HADIR").length / att.length) * 100)
          : 0,
      };
    });

    return Response.json({ classId: targetClassId, students: summary });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
