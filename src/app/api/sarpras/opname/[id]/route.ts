import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

const KONDISI = ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"];

async function ambil(id: string) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const o = await prisma.stokOpname.findUnique({ where: { id } });
  if (!o || !(a.penuh || (a.lab && o.lingkup === "LAB"))) return null;
  return { session, o };
}

/** GET detail (?format=xlsx untuk unduhan berita acara) · PATCH {item:[{id, jumlahFisik, kondisiFisik, catatan}]} · POST {terapkan} = selesai. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const item = await prisma.stokOpnameItem.findMany({
    where: { opnameId: id },
    include: { asset: { select: { name: true, category: true, kodeInventaris: true } } },
    orderBy: [{ lokasiSistem: "asc" }, { asset: { name: "asc" } }],
  });
  if (new URL(req.url).searchParams.get("format") === "xlsx") {
    return balasanExcel({
      namaFile: `stok-opname-${m.o.mulai.toISOString().slice(0, 10)}`, namaSheet: "Stok Opname",
      headers: ["No", "Kode", "Barang", "Kategori", "Lokasi", "Jumlah Sistem", "Jumlah Fisik", "Selisih", "Kondisi Sistem", "Kondisi Fisik", "Catatan"],
      rows: item.map((x, i) => [
        i + 1, x.asset.kodeInventaris ?? "", x.asset.name, x.asset.category, x.lokasiSistem ?? "", x.jumlahSistem,
        x.jumlahFisik ?? "", x.jumlahFisik == null ? "" : x.jumlahFisik - x.jumlahSistem, x.kondisiSistem, x.kondisiFisik ?? "", x.catatan ?? "",
      ]),
    });
  }
  return Response.json({ opname: m.o, item });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  if (m.o.status !== "BERJALAN") return Response.json({ error: "Stok opname sudah selesai." }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const daftar = Array.isArray(b.item) ? b.item.slice(0, 2000) : [];
  await prisma.$transaction(daftar.map((x: { id: string; jumlahFisik?: number | null; kondisiFisik?: string; catatan?: string }) => {
    const jumlah = x.jumlahFisik === null || x.jumlahFisik === undefined || (x.jumlahFisik as unknown) === "" ? null : Math.max(0, Math.round(Number(x.jumlahFisik)));
    return prisma.stokOpnameItem.updateMany({
      where: { id: String(x.id), opnameId: id },
      data: {
        jumlahFisik: Number.isFinite(jumlah) ? jumlah : null,
        kondisiFisik: KONDISI.includes(String(x.kondisiFisik)) ? String(x.kondisiFisik) : null,
        catatan: typeof x.catatan === "string" ? x.catatan.trim().slice(0, 300) || null : undefined,
        diperiksaPada: jumlah === null ? null : new Date(),
      },
    });
  }));
  return Response.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  if (m.o.status !== "BERJALAN") return Response.json({ error: "Stok opname sudah selesai." }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const item = await prisma.stokOpnameItem.findMany({ where: { opnameId: id, jumlahFisik: { not: null } } });
  await prisma.$transaction(async tx => {
    // Terapkan hasil hitung ke data inventaris (opsional, dipilih petugas).
    if (b.terapkan) {
      for (const x of item) {
        const data: Record<string, unknown> = {};
        if (x.jumlahFisik !== null && x.jumlahFisik !== x.jumlahSistem) data.quantity = x.jumlahFisik;
        if (x.kondisiFisik && x.kondisiFisik !== x.kondisiSistem) data.condition = x.kondisiFisik;
        if (Object.keys(data).length) await tx.asset.update({ where: { id: x.assetId }, data });
      }
    }
    await tx.stokOpname.update({ where: { id }, data: { status: "SELESAI", selesaiPada: new Date() } });
  });
  return Response.json({ ok: true, diterapkan: !!b.terapkan });
}
