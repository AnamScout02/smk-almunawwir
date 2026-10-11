import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { aksesEkstra } from "@/lib/ekstra-server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
const teks = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "") || null;

/** Ubah keterangan satu ekskul: jenis (ekstra/intra), pembina luar, jadwal rutin. Khusus koordinator/Admin/TU. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesEkstra(session)).kelola) return Response.json({ error: "Khusus Koordinator Ekstrakurikuler." }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const e = await prisma.extracurricular.findUnique({ where: { id }, select: { name: true } });
  if (!e) return Response.json({ error: "Ekstrakurikuler tidak ditemukan." }, { status: 404 });
  const k = Math.round(Number(b.kuota));
  const kuota = b.kuota === "" || b.kuota == null || !Number.isFinite(k) || k < 1 ? null : Math.min(k, 2000);
  await prisma.extracurricular.update({
    where: { id },
    data: {
      jenis: b.jenis === "INTRA" ? "INTRA" : "EKSTRA", pembinaNama: teks(b.pembinaNama, 120), pembinaKontak: teks(b.pembinaKontak, 40), jadwalRutin: teks(b.jadwalRutin, 200),
      // Hari latihan (0 = Minggu … 6 = Sabtu) untuk pengingat; pendaftaran siswa: terima/tutup, kuota, keterangan.
      hariRutin: [...new Set((Array.isArray(b.hariRutin) ? b.hariRutin : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort(),
      bukaDaftar: b.bukaDaftar !== false, kuota, deskripsi: teks(b.deskripsi, 400),
    },
  });
  await logActivity(session, { action: "UPDATE", entity: "Extracurricular", entityId: id, description: `Memperbarui keterangan ${e.name}` }).catch(() => null);
  return Response.json({ ok: true });
}
