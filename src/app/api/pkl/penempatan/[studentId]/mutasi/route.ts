import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, periksaDudi, sesiPkl, tanggalDari, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";

/** Riwayat pindah tempat PKL satu siswa. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    await sesiPkl();
    const { studentId } = await params;
    const riwayat = await prisma.mutasiPkl.findMany({ where: { internship: { studentId } }, orderBy: { tanggal: "desc" } });
    return Response.json({ riwayat });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** MUTASI = pindah tempat PKL. `Internship` tetap satu baris per siswa dan selalu memuat tempat SEKARANG;
 *  tempat lama dicatat di `MutasiPkl` bersama alasan. Pengantaran direset — siswa diantar lagi ke tempat baru. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await sesiPkl();
    const { studentId } = await params;
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mitraId = typeof b.mitraId === "string" ? b.mitraId : "";
    const tanggal = tanggalDari(b.tanggal);
    const alasan = typeof b.alasan === "string" ? b.alasan.trim().slice(0, 1000) : "";
    if (!mitraId || !tanggal || alasan.length < 5) return Response.json({ error: "DUDI tujuan, tanggal pindah, dan alasan wajib diisi." }, { status: 400 });

    const p = await prisma.internship.findUnique({ where: { studentId }, select: { id: true, mitraId: true, company: true, startDate: true, endDate: true, student: { select: { user: { select: { name: true } } } } } });
    if (!p) return Response.json({ error: "Siswa ini belum menjadi peserta PKL." }, { status: 404 });
    if (p.mitraId === mitraId) return Response.json({ error: "Siswa sudah berada di DUDI itu." }, { status: 400 });
    if (tanggal > p.endDate) return Response.json({ error: "Tanggal pindah melewati tanggal selesai PKL." }, { status: 400 });
    const { mitra, peringatan } = await periksaDudi(mitraId, [studentId]);
    if (!mitra) return Response.json({ error: "DUDI tujuan tidak ditemukan." }, { status: 404 });
    if (peringatan.length && b.paksa !== true) return Response.json({ error: "Perlu dipastikan dulu.", peringatan }, { status: 409 });
    const laporanId = typeof b.laporanId === "string" && b.laporanId ? b.laporanId : null;

    await prisma.$transaction([
      prisma.mutasiPkl.create({
        data: { internshipId: p.id, tanggal, dariMitraId: p.mitraId, dariNama: p.company, dariMulai: p.startDate, keMitraId: mitra.id, keNama: mitra.name, alasan, laporanId, olehNama: session.name },
      }),
      prisma.internship.update({
        where: { id: p.id },
        data: {
          mitraId: mitra.id, company: mitra.name, status: "ONGOING",
          position: typeof b.posisi === "string" && b.posisi.trim() ? b.posisi.trim().slice(0, 120) : undefined,
          supervisor: typeof b.pembimbingIndustri === "string" && b.pembimbingIndustri.trim() ? b.pembimbingIndustri.trim().slice(0, 120) : (mitra.contactPerson ?? "—"),
          diantarPada: null, diantarOleh: null, diterimaOleh: null,
          // Tautan penilaian milik pembimbing di tempat LAMA tidak boleh tetap berlaku.
          tokenPenilaianHash: null, tokenPenilaianSampai: null,
        },
      }),
    ]);
    await logActivity(session, { action: "UPDATE", entity: "Internship", entityId: studentId, description: `Mutasi PKL ${p.student.user.name}: ${p.company} → ${mitra.name} (${alasan.slice(0, 80)})` }).catch(() => null);
    sinkronLatar([studentId]);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
