import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sesiAlokasi, siswaPerTingkat, POS_BAWAAN } from "@/lib/alokasi-dana-server";

export const dynamic = "force-dynamic";

const galat = (e: unknown) => {
  lemparBilaPengalihan(e);
  if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Admin & Bendahara." }, { status: 403 });
  return Response.json({ error: "Gagal memproses." }, { status: 500 });
};

/** Daftar rencana alokasi + jumlah siswa aktif per tingkat + tahun ajaran aktif. */
export async function GET() {
  try {
    await sesiAlokasi();
    const [daftar, siswa, ta] = await Promise.all([
      prisma.alokasiRencana.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, nama: true, tahunAjaran: true, updatedAt: true } }),
      siswaPerTingkat(),
      prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }).catch(() => null),
    ]);
    return Response.json({ daftar, siswaPerTingkat: siswa, tahunAjaranAktif: ta?.name ?? null });
  } catch (e) { return galat(e); }
}

/** Rencana baru: kosong (angkatan X/XI/XII terisi jumlah siswa dari data) atau SALINAN rencana lain (`salinDari`). */
export async function POST(req: Request) {
  try {
    const s = await sesiAlokasi();
    const b = await req.json().catch(() => ({}));
    const nama = String(b.nama ?? "").trim().slice(0, 100) || "Rencana Alokasi";
    const tahunAjaran = String(b.tahunAjaran ?? "").trim().slice(0, 20) || null;
    let angkatan: { nama: string; tingkat: number | null; jumlahSiswa: number; iuran: number; keringanan: object; pos: object; urutan: number }[];
    let bulan = 12, posPenampung: string | null = null;
    if (b.salinDari) {
      const asal = await prisma.alokasiRencana.findUnique({ where: { id: String(b.salinDari) }, include: { angkatan: { orderBy: { urutan: "asc" } } } });
      if (!asal) return Response.json({ error: "Rencana asal tidak ditemukan." }, { status: 404 });
      bulan = asal.bulan; posPenampung = asal.posPenampung;
      angkatan = asal.angkatan.map(a => ({ nama: a.nama, tingkat: a.tingkat, jumlahSiswa: a.jumlahSiswa, iuran: a.iuran, keringanan: a.keringanan as object, pos: a.pos as object, urutan: a.urutan }));
    } else {
      const siswa = await siswaPerTingkat();
      angkatan = [10, 11, 12].map((t, i) => ({
        nama: `Kelas ${["X", "XI", "XII"][i]}`, tingkat: t, jumlahSiswa: siswa[t] ?? 0, iuran: 0, keringanan: [], pos: POS_BAWAAN, urutan: i,
      }));
    }
    const r = await prisma.alokasiRencana.create({
      data: { nama, tahunAjaran, bulan, posPenampung, dibuatOleh: s.name, angkatan: { create: angkatan } },
      select: { id: true },
    });
    await logActivity(s, { action: "CREATE", entity: "AlokasiDana", entityId: r.id, description: `Membuat rencana alokasi dana "${nama}"` }).catch(() => {});
    return Response.json({ id: r.id }, { status: 201 });
  } catch (e) { return galat(e); }
}
