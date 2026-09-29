import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

async function jaga() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertPerpustakaan(session);
  return session;
}

/** STOK OPNAME BUKU — daftar sesi & buat sesi baru (memotret stok & jumlah dipinjam). */
export async function GET() {
  try { await jaga(); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  const daftar = await prisma.stokOpnameBuku.findMany({ orderBy: { mulai: "desc" }, take: 30, include: { _count: { select: { item: true } }, item: { where: { stokFisik: { not: null } }, select: { id: true } } } });
  return Response.json({ daftar: daftar.map(({ _count, item, ...o }) => ({ ...o, jumlahItem: _count.item, diperiksa: item.length })) });
}

export async function POST(req: Request) {
  let session;
  try { session = await jaga(); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  if (await prisma.stokOpnameBuku.count({ where: { status: "BERJALAN" } })) return Response.json({ error: "Masih ada stok opname yang berjalan." }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const [buku, pinjam] = await Promise.all([
    prisma.book.findMany({ select: { id: true, stock: true } }),
    prisma.bookLoan.groupBy({ by: ["bookId"], where: { status: "DIPINJAM" }, _count: { _all: true } }),
  ]);
  if (!buku.length) return Response.json({ error: "Katalog masih kosong." }, { status: 400 });
  const dipinjam = new Map(pinjam.map(p => [p.bookId, p._count._all]));
  const o = await prisma.stokOpnameBuku.create({
    data: {
      judul: String(b.judul ?? "").trim().slice(0, 150) || `Stok opname buku ${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}`,
      olehNama: session.name,
      item: { create: buku.map(x => ({ bookId: x.id, stokSistem: x.stock, dipinjam: dipinjam.get(x.id) ?? 0 })) },
    },
  });
  return Response.json({ id: o.id }, { status: 201 });
}
