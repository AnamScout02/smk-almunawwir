import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

async function ambil(id: string) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const j = await prisma.jadwalPerawatan.findUnique({ where: { id } });
  if (!j || !(a.penuh || (a.lab && j.lingkup === "LAB"))) return null;
  return { session, j };
}

/** aksi "selesai" {tanggal, hasil, catatan} → riwayat + jadwal berikutnya bergeser sesuai interval. Tanpa aksi = ubah isian. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.aksi === "selesai") {
    const tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    if (isNaN(tanggal.getTime())) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
    const hasil = b.hasil === "PERLU_PERBAIKAN" ? "PERLU_PERBAIKAN" : "BAIK";
    const catatan = String(b.catatan ?? "").trim().slice(0, 1000) || null;
    await prisma.$transaction(async tx => {
      await tx.riwayatPerawatan.create({ data: { jadwalId: id, tanggal, hasil, catatan, olehNama: m.session.name } });
      await tx.jadwalPerawatan.update({ where: { id }, data: { terakhir: tanggal, berikutnya: new Date(tanggal.getTime() + m.j.intervalHari * 86400000) } });
      if (hasil === "PERLU_PERBAIKAN") {
        await tx.assetDamageReport.create({
          data: { assetId: m.j.assetId, judul: m.j.assetId ? null : m.j.judul, lokasi: m.j.lokasi, description: `Temuan perawatan "${m.j.judul}": ${catatan ?? "perlu perbaikan"}`, reportedBy: m.session.name, pelaporId: m.session.userId },
        });
      }
    });
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  const data: Record<string, unknown> = {};
  if (typeof b.judul === "string" && b.judul.trim()) data.judul = b.judul.trim().slice(0, 150);
  if (b.intervalHari !== undefined) {
    const n = Math.round(Number(b.intervalHari));
    if (!(n >= 1 && n <= 3650)) return Response.json({ error: "Interval 1–3650 hari." }, { status: 400 });
    data.intervalHari = n;
  }
  if (b.berikutnya) { const d = new Date(b.berikutnya); if (!isNaN(d.getTime())) data.berikutnya = d; }
  if (typeof b.aktif === "boolean") data.aktif = b.aktif;
  if (typeof b.penanggungJawab === "string") data.penanggungJawab = b.penanggungJawab.trim().slice(0, 100) || null;
  if (typeof b.catatan === "string") data.catatan = b.catatan.trim().slice(0, 500) || null;
  if (typeof b.lokasi === "string" && !m.j.assetId) data.lokasi = b.lokasi.trim().slice(0, 150) || null;
  await prisma.jadwalPerawatan.update({ where: { id }, data });
  segarkanAntrean();
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.jadwalPerawatan.delete({ where: { id } });
  segarkanAntrean();
  return Response.json({ ok: true });
}
