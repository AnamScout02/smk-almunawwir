import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { rapikanAngkatan, type AngkatanMasuk } from "@/lib/alokasi-dana";
import { sesiAlokasi, muatRencana, siswaPerTingkat } from "@/lib/alokasi-dana-server";

export const dynamic = "force-dynamic";

const galat = (e: unknown) => {
  lemparBilaPengalihan(e);
  if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Admin & Bendahara." }, { status: 403 });
  return Response.json({ error: "Gagal memproses." }, { status: 500 });
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await sesiAlokasi();
    const [r, siswa] = await Promise.all([muatRencana((await params).id), siswaPerTingkat()]);
    if (!r) return Response.json({ error: "Rencana tidak ditemukan." }, { status: 404 });
    return Response.json({ ...r, siswaPerTingkat: siswa });
  } catch (e) { return galat(e); }
}

/** Simpan seluruh rencana. Angkatan dicocokkan lewat `id`: yang ada diperbarui, yang baru dibuat, yang dihapus dari layar
 *  dihapus (transaksinya TIDAK ikut hilang — `angkatanId` jadi kosong dan uangnya tampil "Belum dialokasikan"). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await sesiAlokasi();
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const ada = await prisma.alokasiRencana.findUnique({ where: { id }, select: { angkatan: { select: { id: true } } } });
    if (!ada) return Response.json({ error: "Rencana tidak ditemukan." }, { status: 404 });
    const angkatan = ((Array.isArray(b.angkatan) ? b.angkatan : []) as Partial<AngkatanMasuk>[]).slice(0, 30).map(a => rapikanAngkatan(a));
    const idLama = new Set(ada.angkatan.map(a => a.id));
    const dipertahankan = new Set<string>(angkatan.map(a => a.id).filter((x): x is string => !!x && idLama.has(x)));
    await prisma.$transaction(async tx => {
      await tx.alokasiRencana.update({
        where: { id },
        data: {
          nama: String(b.nama ?? "").trim().slice(0, 100) || "Rencana Alokasi",
          tahunAjaran: String(b.tahunAjaran ?? "").trim().slice(0, 20) || null,
          bulan: Math.min(24, Math.max(1, Math.round(Number(b.bulan)) || 12)),
          posPenampung: String(b.posPenampung ?? "").trim().slice(0, 80) || null,
          catatan: String(b.catatan ?? "").slice(0, 2000) || null,
        },
      });
      await tx.alokasiAngkatan.deleteMany({ where: { rencanaId: id, id: { notIn: [...dipertahankan] } } });
      for (const [urutan, a] of angkatan.entries()) {
        const data = { nama: a.nama, tingkat: a.tingkat, jumlahSiswa: a.jumlahSiswa, iuran: a.iuran, keringanan: a.keringanan as object, pos: a.pos as object, urutan };
        if (a.id && dipertahankan.has(a.id)) await tx.alokasiAngkatan.update({ where: { id: a.id }, data });
        else await tx.alokasiAngkatan.create({ data: { ...data, rencanaId: id } });
      }
    });
    return Response.json({ ...(await muatRencana(id)), siswaPerTingkat: await siswaPerTingkat() });
  } catch (e) { return galat(e); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await sesiAlokasi();
    const { id } = await params;
    const r = await prisma.alokasiRencana.delete({ where: { id }, select: { nama: true } }).catch(() => null);
    if (!r) return Response.json({ error: "Rencana tidak ditemukan." }, { status: 404 });
    await logActivity(s, { action: "DELETE", entity: "AlokasiDana", entityId: id, description: `Menghapus rencana alokasi dana "${r.nama}"` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { return galat(e); }
}
