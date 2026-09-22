import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, LAB_ASSET_FILTER } from "@/lib/sarpras-akses";

export const dynamic = "force-dynamic";

/** STOK OPNAME — pengelola membuat sesi; sistem memotret jumlah/kondisi/lokasi aset saat itu, lalu petugas mengisi hasil hitung fisik. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const daftar = await prisma.stokOpname.findMany({
    where: a.penuh ? {} : { lingkup: "LAB" }, orderBy: { mulai: "desc" }, take: 50,
    include: { _count: { select: { item: true } }, item: { where: { diperiksaPada: { not: null } }, select: { id: true } } },
  });
  return Response.json({
    akses: a,
    daftar: daftar.map(({ _count, item, ...o }) => ({ ...o, jumlahItem: _count.item, diperiksa: item.length })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) return Response.json({ error: "Khusus pengelola Sarpras/Lab." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const lingkup = !a.penuh || b.lingkup === "LAB" ? "LAB" : "SEMUA";
  const judul = String(b.judul ?? "").trim().slice(0, 150) || `Stok opname ${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}`;
  const berjalan = await prisma.stokOpname.count({ where: { status: "BERJALAN", lingkup } });
  if (berjalan) return Response.json({ error: "Masih ada stok opname yang berjalan untuk lingkup ini — selesaikan dulu." }, { status: 409 });
  const aset = await prisma.asset.findMany({ where: lingkup === "LAB" ? LAB_ASSET_FILTER : {}, select: { id: true, quantity: true, condition: true, location: true } });
  if (!aset.length) return Response.json({ error: "Belum ada aset pada lingkup ini." }, { status: 400 });
  const o = await prisma.stokOpname.create({
    data: {
      judul, lingkup, olehNama: session.name,
      item: { create: aset.map(x => ({ assetId: x.id, jumlahSistem: x.quantity, kondisiSistem: x.condition, lokasiSistem: x.location })) },
    },
  });
  return Response.json({ id: o.id }, { status: 201 });
}
