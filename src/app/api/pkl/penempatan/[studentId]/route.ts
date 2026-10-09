import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, periksaDudi, sesiPkl, tanggalDari, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";
import { TEMPAT_BELUM_DITENTUKAN } from "@/lib/pkl-tempat";

export const dynamic = "force-dynamic";
const teks = (v: unknown, maks = 120) => (typeof v === "string" ? v.trim().slice(0, maks) : "");

/** Penempatan SATU siswa: DUDI, posisi, pembimbing, tanggal, status, serta pengantaran & penjemputan. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await sesiPkl();
    const { studentId } = await params;
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mulai = tanggalDari(b.mulai), selesai = tanggalDari(b.selesai);
    if (!mulai || !selesai) return Response.json({ error: "Tanggal mulai dan selesai wajib diisi." }, { status: 400 });
    if (selesai < mulai) return Response.json({ error: "Tanggal selesai lebih awal dari tanggal mulai." }, { status: 400 });
    const status = ["ONGOING", "COMPLETED", "CANCELLED"].includes(b.status as string) ? (b.status as string) : "ONGOING";
    const mitraId = typeof b.mitraId === "string" && b.mitraId ? b.mitraId : null;
    const guruId = typeof b.guruId === "string" && b.guruId ? b.guruId : null;

    const [siswa, lama] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { user: { select: { name: true } } } }),
      prisma.internship.findUnique({ where: { studentId }, select: { mitraId: true, startDate: true, status: true } }),
    ]);
    if (!siswa) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
    if (lama?.mitraId && mitraId && lama.mitraId !== mitraId && lama.status === "ONGOING" && lama.startDate <= new Date()) {
      return Response.json({ error: "PKL siswa ini sudah berjalan di tempat lain. Gunakan tombol Mutasi supaya riwayat dan alasannya tercatat." }, { status: 409 });
    }
    let namaMitra = TEMPAT_BELUM_DITENTUKAN;
    if (mitraId) {
      const { mitra, peringatan } = await periksaDudi(mitraId, [studentId]);
      if (!mitra) return Response.json({ error: "DUDI tidak ditemukan." }, { status: 404 });
      if (peringatan.length && b.paksa !== true && lama?.mitraId !== mitraId) return Response.json({ error: "Perlu dipastikan dulu.", peringatan }, { status: 409 });
      namaMitra = mitra.name;
    }
    if (guruId && !(await prisma.teacher.findUnique({ where: { id: guruId }, select: { id: true } }))) {
      return Response.json({ error: "Guru pembimbing tidak ditemukan." }, { status: 400 });
    }
    const lamaBulan = Number.isInteger(b.lamaBulan) && (b.lamaBulan as number) > 0 && (b.lamaBulan as number) <= 12 ? (b.lamaBulan as number) : null;
    const data = {
      mitraId, company: namaMitra, position: teks(b.posisi) || "—", supervisor: teks(b.pembimbingIndustri) || "—",
      startDate: mulai, endDate: selesai, lamaBulan, status, teacherId: guruId,
      diantarPada: tanggalDari(b.diantarPada), diantarOleh: teks(b.diantarOleh) || null, diterimaOleh: teks(b.diterimaOleh) || null,
      dijemputPada: tanggalDari(b.dijemputPada), dijemputOleh: teks(b.dijemputOleh) || null,
    };
    await prisma.internship.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
    sinkronLatar([studentId]);
    await logActivity(session, { action: "UPDATE", entity: "Internship", entityId: studentId, description: `Menyimpan penempatan PKL ${siswa.user.name} (${namaMitra})` }).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** Mengeluarkan siswa dari daftar peserta PKL (jurnal, monitoring, dan riwayat mutasinya ikut terhapus). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await sesiPkl();
    const { studentId } = await params;
    const p = await prisma.internship.findUnique({ where: { studentId }, select: { company: true, student: { select: { user: { select: { name: true } } } }, _count: { select: { journal: true, monitoring: true } } } });
    if (!p) return Response.json({ error: "Data PKL tidak ditemukan." }, { status: 404 });
    await prisma.internship.delete({ where: { studentId } });
    await logActivity(session, { action: "DELETE", entity: "Internship", entityId: studentId, description: `Menghapus data PKL ${p.student.user.name} (${p.company}; ${p._count.journal} jurnal, ${p._count.monitoring} monitoring)` }).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
