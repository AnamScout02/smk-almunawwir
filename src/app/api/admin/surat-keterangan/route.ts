import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
} as const;

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const sp = new URL(req.url).searchParams;
    const year = sp.get("year");
    const where = year && /^\d{4}$/.test(year)
      ? { tanggal: { gte: new Date(Number(year), 0, 1), lt: new Date(Number(year) + 1, 0, 1) } }
      : {};
    const rows = await prisma.suratKeterangan.findMany({
      where, include, orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }], take: year ? undefined : 300,
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat surat keterangan" }, { status: 500 });
  }
}

/** Pembuatan langsung lewat endpoint ini SENGAJA DIHENTIKAN (13 September 2026).
 * Surat keterangan sekarang dibuat sebagai surat keluar biasa di Persuratan (pustaka template),
 * atau lahir otomatis saat permohonan dari portal disetujui — lihat
 * `src/lib/surat-dari-permohonan.ts`. Endpoint ini tinggal melayani GET (daftar permohonan lama)
 * dan DELETE (membersihkan sisa data lama dari buku agenda). */
export async function POST() {
  return Response.json({
    error: "Surat Keterangan sekarang dibuat dari menu Persuratan — pilih kategori Keterangan pada pustaka template.",
  }, { status: 410 });
}
