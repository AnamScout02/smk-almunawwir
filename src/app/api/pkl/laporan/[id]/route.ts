import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import { logActivity } from "@/lib/activity-log";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { JENIS_LAPORAN } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** Tindak lanjut laporan: BARU → DITANGANI → SELESAI, dengan catatan penyelesaiannya. Siswa pelapor dikabari. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { id } = await params;
    const l = await prisma.laporanPkl.findUnique({ where: { id }, select: { status: true, jenis: true, pelapor: true, internship: { select: { teacher: { select: { userId: true } }, student: { select: { userId: true, user: { select: { name: true } } } } } } } });
    if (!l) return Response.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    if (!(await aksesPusatPkl(session)) && l.internship.teacher?.userId !== session.userId) return Response.json({ error: "Hanya Humas atau guru pembimbing siswa itu." }, { status: 403 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const status = ["BARU", "DITANGANI", "SELESAI"].includes(b.status as string) ? (b.status as string) : l.status;
    const tindakLanjut = typeof b.tindakLanjut === "string" ? b.tindakLanjut.trim().slice(0, 2000) : "";
    if (status !== "BARU" && tindakLanjut.length < 5) return Response.json({ error: "Tulis tindak lanjutnya (min. 5 huruf)." }, { status: 400 });
    const kini = new Date();
    await prisma.laporanPkl.update({
      where: { id },
      data: {
        status, tindakLanjut: tindakLanjut || null, ditanganiOleh: status === "BARU" ? null : session.name,
        ditanganiPada: status === "BARU" ? null : kini, selesaiPada: status === "SELESAI" ? kini : null,
      },
    });
    await logActivity(session, { action: "UPDATE", entity: "LaporanPkl", entityId: id, description: `Laporan PKL ${l.internship.student.user.name} (${JENIS_LAPORAN[l.jenis] ?? l.jenis}) → ${status}` }).catch(() => null);
    if (status !== l.status && status !== "BARU") {
      kirimLatar(() => kirimNotifikasi({
        userIds: [l.internship.student.userId], jenis: "PKL", kunci: `pkl-laporan:${id}:${status}`,
        judul: status === "SELESAI" ? "Laporan PKL Anda sudah diselesaikan" : "Laporan PKL Anda sedang ditangani",
        isi: tindakLanjut.slice(0, 160), url: "/dashboard/student/pkl",
      }));
    }
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
