import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, cekBentrokRuang, sisaBarang } from "@/lib/sarpras-akses";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { DISETUJUI: "disetujui", DITOLAK: "ditolak", DIPINJAM: "diserahkan", DIKEMBALIKAN: "dikembalikan" };

/** aksi: setujui | tolak | serahkan | kembalikan (pengelola sesuai lingkup) · batal (peminjam, sebelum diserahkan). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const { id } = await params;
  const p = await prisma.peminjamanSarpras.findUnique({ where: { id }, include: { asset: { select: { name: true, quantity: true } } } });
  if (!p) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const aksi = String(b.aksi ?? "");
  const catatan = typeof b.catatan === "string" ? b.catatan.trim().slice(0, 300) : undefined;

  if (aksi === "batal") {
    if (p.peminjamId !== session.userId && !a.penuh) return Response.json({ error: "Tidak berhak." }, { status: 403 });
    if (!["MENUNGGU", "DISETUJUI"].includes(p.status)) return Response.json({ error: "Permohonan ini tidak bisa dibatalkan lagi." }, { status: 409 });
    await prisma.peminjamanSarpras.update({ where: { id }, data: { status: "DIBATALKAN" } });
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  const berhak = a.penuh || (a.lab && p.lingkup === "LAB");
  if (!berhak) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });

  let status: string;
  const data: Record<string, unknown> = { diputuskanOleh: session.name };
  if (aksi === "setujui" && p.status === "MENUNGGU") {
    if (p.jenis === "RUANG" && p.ruang) {
      const bentrok = await cekBentrokRuang(p.ruang, p.mulai, p.selesai, p.id);
      const lain = bentrok.peminjaman.filter(x => x.status !== "MENUNGGU");
      if ((lain.length || bentrok.jadwal.length) && !b.abaikanBentrok) {
        return Response.json({ error: `Bentrok: ${[...lain.map(x => `dipesan ${x.peminjamNama}`), ...bentrok.jadwal.map(j => `jadwal ${j}`)].slice(0, 3).join("; ")}.`, bentrok: true }, { status: 409 });
      }
    }
    if (p.jenis === "BARANG" && p.assetId && p.asset) {
      const sisa = await sisaBarang(p.assetId, p.asset.quantity, p.mulai, p.selesai, p.id);
      if (sisa < p.jumlah) return Response.json({ error: `Unit tersisa hanya ${Math.max(sisa, 0)}.` }, { status: 409 });
    }
    status = "DISETUJUI";
  } else if (aksi === "tolak" && ["MENUNGGU", "DISETUJUI"].includes(p.status)) status = "DITOLAK";
  else if (aksi === "serahkan" && p.status === "DISETUJUI") status = "DIPINJAM";
  else if (aksi === "kembalikan" && ["DIPINJAM", "DISETUJUI"].includes(p.status)) {
    status = "DIKEMBALIKAN";
    data.kondisiKembali = ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"].includes(b.kondisi) ? b.kondisi : "BAIK";
  } else return Response.json({ error: "Aksi tidak sesuai status permohonan." }, { status: 409 });
  data.status = status;
  if (catatan !== undefined) data.catatan = catatan || p.catatan;

  await prisma.$transaction(async tx => {
    await tx.peminjamanSarpras.update({ where: { id }, data });
    // Barang kembali rusak → kondisi aset & laporan kerusakan otomatis.
    if (status === "DIKEMBALIKAN" && p.assetId && data.kondisiKembali !== "BAIK") {
      await tx.asset.update({ where: { id: p.assetId }, data: { condition: String(data.kondisiKembali) } });
      await tx.assetDamageReport.create({
        data: { assetId: p.assetId, description: `Dikembalikan dalam kondisi ${String(data.kondisiKembali).replace("_", " ").toLowerCase()} setelah dipinjam ${p.peminjamNama}. ${catatan ?? ""}`.trim(), reportedBy: session.name, pelaporId: session.userId },
      });
    }
  });
  if (LABEL[status] && status !== "DIKEMBALIKAN") {
    kirimLatar(() => kirimNotifikasi({
      userIds: [p.peminjamId], jenis: "SARPRAS", kunci: `pinjam-${status}:${id}`,
      judul: `Permohonan ${p.jenis === "RUANG" ? `ruang ${p.ruang}` : p.asset?.name ?? "peminjaman"} ${LABEL[status]}`,
      isi: `${p.keperluan.slice(0, 80)}${catatan ? ` — ${catatan}` : ""} (${session.name})`,
      url: "/layanan-sarpras", tag: `pinjam-${id}`,
    }));
  }
  segarkanAntrean();
  return Response.json({ ok: true });
}
