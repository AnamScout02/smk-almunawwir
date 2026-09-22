import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hakKegiatan } from "@/lib/kegiatan-qr";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Keputusan atas usulan kegiatan (18 September 2026): disetujui / ditolak oleh pemegang hak
 * pengumuman (Kepala Sekolah, para Wakil Kepala, TU, Admin). Pengusul mendapat notifikasi. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  const hak = await hakKegiatan(session);
  if (!hak.semua) return Response.json({ error: "Hanya pimpinan & Tata Usaha yang bisa memutuskan." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const setuju = b.setuju === true;
  const kegiatan = await prisma.kegiatan.findUnique({ where: { id }, select: { id: true, judul: true, pembuatId: true } });
  if (!kegiatan) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });

  await prisma.kegiatan.update({
    where: { id },
    data: {
      statusPersetujuan: setuju ? "DISETUJUI" : "DITOLAK",
      catatanPersetujuan: String(b.catatan ?? "").trim().slice(0, 500) || null,
      pemutusNama: session.name, diputusPada: new Date(),
    },
  });

  kirimLatar(() => kirimNotifikasi({
    userIds: [kegiatan.pembuatId], kunci: `kegiatan-putusan:${id}:${setuju ? "ya" : "tidak"}`, jenis: "KEGIATAN",
    judul: `${setuju ? "Disetujui" : "Ditolak"}: ${kegiatan.judul}`,
    isi: `Diputuskan ${session.name}${b.catatan ? ` — ${String(b.catatan).slice(0, 120)}` : ""}`,
    url: "/dashboard/teacher/kegiatan",
  }));
  return Response.json({ ok: true });
}
