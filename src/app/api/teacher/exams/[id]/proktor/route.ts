import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { cuplikanUjian } from "@/lib/proktor-layar";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Daftar layar peserta yang sedang mengirim potret (Layar Proktor, src/lib/proktor-layar.ts). Gambarnya diambil
 *  terpisah lewat /proktor/[studentId] supaya daftar ini tetap ringan saat disegarkan tiap 10 detik. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const m = cuplikanUjian(id);
    const siswa = m.size ? await prisma.student.findMany({
      where: { id: { in: [...m.keys()] } },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
    }) : [];
    const layar = siswa.map(s => {
      const c = m.get(s.id)!;
      return { studentId: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "", waktu: c.waktu, fokus: c.fokus };
    }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
    return Response.json({ layar, sekarang: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal." }, { status: 500 });
  }
}
