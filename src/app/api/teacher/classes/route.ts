import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

// Kelas yang boleh diakses guru: kelas wali (bebas mapel apapun) DIGABUNG kelas yang diampu lewat
// Penugasan Mengajar. Dulu dipakai jg oleh halaman Input Nilai (dihapus per keputusan user
// 2026-08-08 — nilai sekarang dari Jurnal Mengajar, lihat src/lib/journal-grades.ts); sekarang
// dipakai halaman Absensi. Absensi KHUSUS wali kelas (per keputusan terbaru) — panggil dgn
// ?scope=homeroom utk dapat kelas wali SAJA, tanpa gabungan Penugasan Mengajar.
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const homeroomOnly = req.nextUrl.searchParams.get("scope") === "homeroom";
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: {
        homeroomOf: {
          include: {
            major: true,
            students: { select: { id: true }, where: { studentStatus: "AKTIF" } },
          },
          orderBy: { grade: "asc" },
        },
        // Selalu di-include (biar tipe hasil query Prisma-nya konsisten) — kalau homeroomOnly,
        // hasilnya cuma di-skip saat digabung di bawah, bukan skip di level query.
        teachingLoad: {
          select: {
            class: {
              include: {
                major: true,
                students: { select: { id: true }, where: { studentStatus: "AKTIF" } },
              },
            },
          },
        },
      },
    });

    const byId = new Map<string, NonNullable<typeof teacher>["homeroomOf"][number]>();
    for (const c of teacher?.homeroomOf ?? []) byId.set(c.id, c);
    if (!homeroomOnly) for (const a of teacher?.teachingLoad ?? []) if (!byId.has(a.class.id)) byId.set(a.class.id, a.class);

    const classes = [...byId.values()].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
    return Response.json(classes);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
