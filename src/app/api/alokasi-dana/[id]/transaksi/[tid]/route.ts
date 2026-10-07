import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sesiAlokasi } from "@/lib/alokasi-dana-server";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; tid: string }> }) {
  try {
    const s = await sesiAlokasi();
    const { id, tid } = await params;
    const t = await prisma.alokasiTransaksi.findFirst({ where: { id: tid, rencanaId: id } });
    if (!t) return Response.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
    await prisma.alokasiTransaksi.delete({ where: { id: tid } });
    await logActivity(s, { action: "DELETE", entity: "AlokasiDana", entityId: id,
      description: `Menghapus catatan ${t.jenis === "MASUK" ? "uang masuk" : "pengeluaran"} Rp${t.jumlah.toLocaleString("id-ID")}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Admin & Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus." }, { status: 500 });
  }
}
