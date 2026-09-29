import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

async function jaga() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertPerpustakaan(session);
  return session;
}

/** GET detail (?format=xlsx) · PATCH {pindai: barcode} = tambah 1 eksemplar terhitung, atau {itemId, stokFisik, catatan} · POST {terapkan} = selesai. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await jaga(); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  const { id } = await params;
  const o = await prisma.stokOpnameBuku.findUnique({ where: { id } });
  if (!o) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const item = await prisma.stokOpnameBukuItem.findMany({ where: { opnameId: id } });
  const buku = await prisma.book.findMany({ where: { id: { in: item.map(i => i.bookId) } }, select: { id: true, title: true, author: true, barcode: true, category: true, location: true } });
  const peta = new Map(buku.map(b => [b.id, b]));
  const baris = item.map(i => ({ ...i, buku: peta.get(i.bookId) ?? null })).sort((a, b) => (a.buku?.location ?? "").localeCompare(b.buku?.location ?? "") || (a.buku?.title ?? "").localeCompare(b.buku?.title ?? ""));
  if (new URL(req.url).searchParams.get("format") === "xlsx") {
    return balasanExcel({
      namaFile: `stok-opname-buku-${o.mulai.toISOString().slice(0, 10)}`, namaSheet: "Stok Opname Buku",
      headers: ["No", "Barcode", "Judul", "Pengarang", "Kategori", "Rak", "Stok Sistem", "Sedang Dipinjam", "Seharusnya di Rak", "Terhitung", "Selisih", "Catatan"],
      rows: baris.map((x, i) => {
        const harus = x.stokSistem - x.dipinjam;
        return [i + 1, x.buku?.barcode ?? "", x.buku?.title ?? "(buku terhapus)", x.buku?.author ?? "", x.buku?.category ?? "", x.buku?.location ?? "", x.stokSistem, x.dipinjam, harus, x.stokFisik ?? "", x.stokFisik == null ? "" : x.stokFisik - harus, x.catatan ?? ""];
      }),
    });
  }
  return Response.json({ opname: o, item: baris });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await jaga(); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  const { id } = await params;
  const o = await prisma.stokOpnameBuku.findUnique({ where: { id }, select: { status: true } });
  if (!o || o.status !== "BERJALAN") return Response.json({ error: "Stok opname tidak berjalan." }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.pindai === "string") {
    const kode = b.pindai.trim();
    const buku = kode ? await prisma.book.findUnique({ where: { barcode: kode }, select: { id: true, title: true } }) : null;
    if (!buku) return Response.json({ error: `Barcode ${kode.slice(0, 40)} tidak ada di katalog.` }, { status: 404 });
    const it = await prisma.stokOpnameBukuItem.findUnique({ where: { opnameId_bookId: { opnameId: id, bookId: buku.id } } });
    if (!it) return Response.json({ error: `"${buku.title}" belum ada di daftar sesi ini (ditambahkan setelah sesi dibuat).` }, { status: 404 });
    const baru = await prisma.stokOpnameBukuItem.update({ where: { id: it.id }, data: { stokFisik: (it.stokFisik ?? 0) + 1, diperiksaPada: new Date() } });
    return Response.json({ ok: true, judul: buku.title, terhitung: baru.stokFisik, seharusnya: baru.stokSistem - baru.dipinjam, itemId: baru.id });
  }
  const n = b.stokFisik === null || b.stokFisik === "" ? null : Math.max(0, Math.round(Number(b.stokFisik)));
  await prisma.stokOpnameBukuItem.updateMany({
    where: { id: String(b.itemId ?? ""), opnameId: id },
    data: { stokFisik: Number.isFinite(n) ? n : null, catatan: typeof b.catatan === "string" ? b.catatan.trim().slice(0, 300) || null : undefined, diperiksaPada: n === null ? null : new Date() },
  });
  return Response.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await jaga(); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Khusus petugas perpustakaan." }, { status: 403 }); }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const item = await prisma.stokOpnameBukuItem.findMany({ where: { opnameId: id, stokFisik: { not: null } } });
  await prisma.$transaction(async tx => {
    if (b.terapkan) {
      // Stok baru = yang terhitung di rak + yang sedang dipinjam saat sesi dibuat.
      for (const x of item) {
        const stokBaru = (x.stokFisik ?? 0) + x.dipinjam;
        if (stokBaru !== x.stokSistem) await tx.book.updateMany({ where: { id: x.bookId }, data: { stock: stokBaru } });
      }
    }
    await tx.stokOpnameBuku.update({ where: { id }, data: { status: "SELESAI", selesaiPada: new Date() } });
  });
  return Response.json({ ok: true });
}
