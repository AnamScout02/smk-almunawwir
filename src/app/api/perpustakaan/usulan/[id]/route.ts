import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DISETUJUI: "disetujui untuk diadakan", DIBELI: "sudah tersedia di perpustakaan", DITOLAK: "belum bisa diadakan", DIUSULKAN: "dikembalikan ke usulan" };

/** aksi: dukung | batalDukung (anggota) · status {status, tanggapan} (petugas) · hapus (pengusul sebelum ditanggapi / petugas). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  const { id } = await params;
  const u = await prisma.usulanBuku.findUnique({ where: { id } });
  if (!u) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.aksi === "dukung" || b.aksi === "batalDukung") {
    if (u.pengusulId === session.userId) return Response.json({ error: "Ini usulan Anda sendiri." }, { status: 400 });
    const set = new Set(u.pendukung);
    if (b.aksi === "dukung") set.add(session.userId); else set.delete(session.userId);
    await prisma.usulanBuku.update({ where: { id }, data: { pendukung: [...set] } });
    return Response.json({ ok: true });
  }
  try { await assertPerpustakaan(session); } catch { return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  const status = STATUS[b.status] ? b.status : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  await prisma.usulanBuku.update({ where: { id }, data: { status, tanggapan: String(b.tanggapan ?? "").trim().slice(0, 500) || null } });
  if (status !== u.status && status !== "DIUSULKAN") {
    kirimLatar(() => kirimNotifikasi({
      userIds: [u.pengusulId, ...u.pendukung], jenis: "PERPUS_RESERVASI", kunci: `usulan-buku:${id}:${status}`,
      judul: `Usulan "${u.judul}" ${STATUS[status]}`, isi: String(b.tanggapan ?? "").slice(0, 120) || "Terima kasih atas usulannya.", url: "/perpustakaan/usulan", tag: `usulan-${id}`,
    }));
  }
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  const { id } = await params;
  const u = await prisma.usulanBuku.findUnique({ where: { id } });
  if (!u) return Response.json({ ok: true });
  let petugas = false;
  try { await assertPerpustakaan(session); petugas = true; } catch { /* bukan petugas */ }
  if (!petugas && !(u.pengusulId === session.userId && u.status === "DIUSULKAN")) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.usulanBuku.delete({ where: { id } });
  return Response.json({ ok: true });
}
