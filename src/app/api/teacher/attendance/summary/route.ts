import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const classId = req.nextUrl.searchParams.get("classId");

    let targetClassId: string;
    if (session.role === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        include: { homeroomOf: { select: { id: true } } },
      });
      const allowedClassIds = teacher?.homeroomOf.map(c => c.id) ?? [];
      if (allowedClassIds.length === 0) return Response.json([]);
      targetClassId = classId && allowedClassIds.includes(classId) ? classId : allowedClassIds[0];
    } else {
      // ADMIN tidak terikat kelas wali — bebas lihat kelas manapun, wajib kirim classId eksplisit.
      if (!classId) return Response.json({ error: "classId wajib diisi" }, { status: 400 });
      targetClassId = classId;
    }

    const students = await prisma.student.findMany({
      where: { classId: targetClassId, studentStatus: "AKTIF" },
      include: {
        user: { select: { name: true } },
        attendance: true,
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
