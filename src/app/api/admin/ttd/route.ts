import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { petugasTu } from "@/lib/tas-access-guard";
import { PERAN_TTD } from "@/lib/ttd";

export const dynamic = "force-dynamic";

/** Daftar guru & staf beserta status TTD-nya (halaman Tanda Tangan Pegawai, khusus Admin & TU). */
export async function GET() {
  try {
    await verifySession();
    if (!(await petugasTu())) return Response.json({ error: "Khusus Tata Usaha." }, { status: 403 });
    const daftar = await prisma.user.findMany({
      where: { role: { in: [...PERAN_TTD] } }, orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, ttdBerkas: true, ttdDiperbarui: true, teacher: { select: { nip: true, teacherStatus: true } } },
    });
    return Response.json({
      daftar: daftar.filter(u => !u.teacher || u.teacher.teacherStatus !== "KELUAR").map(u => ({
        id: u.id, nama: u.name, peran: u.role, nip: u.teacher?.nip ?? null, ada: !!u.ttdBerkas, diperbarui: u.ttdDiperbarui,
      })),
    });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat." }, { status: 500 }); }
}
