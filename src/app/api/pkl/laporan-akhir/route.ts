import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { aksesPkl, aksesPusatPkl } from "@/lib/pkl-humas";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** LAPORAN AKHIR PKL — panitia PKL melihat semua, guru pembimbing hanya siswa bimbingannya. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const semua = await aksesPusatPkl(session);
    const baris = await prisma.internship.findMany({
      where: { laporanAkhirUrl: { not: null }, ...(semua ? {} : { teacher: { userId: session.userId } }) },
      orderBy: { laporanAkhirPada: "desc" },
      select: {
        id: true, company: true, laporanAkhirUrl: true, laporanAkhirStatus: true, laporanAkhirCatatan: true, laporanAkhirPada: true,
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
      },
    });
    return Response.json({
      semua,
      laporan: baris.map(b => ({ id: b.id, nama: b.student.user.name, nis: b.student.nis, kelas: b.student.class?.name ?? null, tempat: b.company, guru: b.teacher?.user.name ?? null,
        url: b.laporanAkhirUrl, status: b.laporanAkhirStatus ?? "DIKIRIM", catatan: b.laporanAkhirCatatan, pada: b.laporanAkhirPada })),
    });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat laporan akhir." }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const pkl = typeof b.id === "string" ? await aksesPkl(session, b.id) : null;
    if (!pkl || !pkl.laporanAkhirUrl) return Response.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
    const status = b.status === "DISETUJUI" || b.status === "REVISI" ? b.status : "";
    const catatan = typeof b.catatan === "string" ? b.catatan.trim().slice(0, 1000) : "";
    if (!status) return Response.json({ error: "Pilih Setujui atau Minta Revisi." }, { status: 400 });
    if (status === "REVISI" && catatan.length < 5) return Response.json({ error: "Tulis apa yang perlu diperbaiki." }, { status: 400 });
    await prisma.internship.update({ where: { id: pkl.id }, data: { laporanAkhirStatus: status, laporanAkhirCatatan: catatan || null } });
    const siswa = await prisma.student.findUnique({ where: { id: pkl.studentId }, select: { userId: true } });
    if (siswa) kirimLatar(() => kirimNotifikasi({
      userIds: [siswa.userId], jenis: "PKL", kunci: `pkl-laporan-akhir:${pkl.id}:${status}:${Date.now()}`,
      judul: status === "DISETUJUI" ? "Laporan akhir PKL disetujui" : "Laporan akhir PKL perlu direvisi",
      isi: status === "DISETUJUI" ? "Laporan akhir PKL-mu sudah disetujui." : catatan.slice(0, 140), url: "/dashboard/student/pkl",
    }));
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan keputusan." }, { status: 500 }); }
}
