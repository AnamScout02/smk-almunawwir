import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, lingkupDari } from "@/lib/sarpras-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

/** PERAWATAN BERKALA — pengelola Sarpras (semua) & Kepala Lab (lingkup LAB). */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const where = a.penuh ? {} : { lingkup: "LAB" };
  const [daftar, aset] = await Promise.all([
    prisma.jadwalPerawatan.findMany({
      where, orderBy: [{ aktif: "desc" }, { berikutnya: "asc" }],
      include: { asset: { select: { id: true, name: true, location: true } }, riwayat: { orderBy: { tanggal: "desc" }, take: 5 } },
    }),
    prisma.asset.findMany({ select: { id: true, name: true, category: true, location: true }, orderBy: { name: "asc" } }),
  ]);
  return Response.json({ akses: a, daftar, aset: a.penuh ? aset : aset.filter(x => lingkupDari({ asset: x }) === "LAB") });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 150);
  const intervalHari = Math.round(Number(b.intervalHari));
  const berikutnya = new Date(b.berikutnya);
  if (!judul) return Response.json({ error: "Tulis nama pekerjaan perawatan." }, { status: 400 });
  if (!(intervalHari >= 1 && intervalHari <= 3650)) return Response.json({ error: "Interval 1–3650 hari." }, { status: 400 });
  if (isNaN(berikutnya.getTime())) return Response.json({ error: "Tanggal perawatan berikutnya wajib diisi." }, { status: 400 });
  const asset = b.assetId ? await prisma.asset.findUnique({ where: { id: String(b.assetId) }, select: { id: true, category: true, location: true } }) : null;
  const lokasi = String(b.lokasi ?? "").trim().slice(0, 150) || null;
  const lingkup = lingkupDari({ asset, lokasi });
  if (!a.penuh && lingkup !== "LAB") return Response.json({ error: "Kepala Laboratorium hanya mengatur perawatan barang/ruang lab." }, { status: 403 });
  await prisma.jadwalPerawatan.create({
    data: { judul, intervalHari, berikutnya, assetId: asset?.id ?? null, lokasi, lingkup, penanggungJawab: String(b.penanggungJawab ?? "").trim().slice(0, 100) || null, catatan: String(b.catatan ?? "").trim().slice(0, 500) || null },
  });
  segarkanAntrean();
  return Response.json({ ok: true }, { status: 201 });
}
