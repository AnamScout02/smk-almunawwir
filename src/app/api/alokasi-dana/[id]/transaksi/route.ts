import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sesiAlokasi } from "@/lib/alokasi-dana-server";

export const dynamic = "force-dynamic";

/** Catat REALISASI: MASUK (iuran terkumpul satu angkatan) atau KELUAR (belanja dari satu pos). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await sesiAlokasi();
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const jenis = b.jenis === "KELUAR" ? "KELUAR" : "MASUK";
    const jumlah = Math.round(Number(b.jumlah));
    if (!Number.isFinite(jumlah) || jumlah <= 0 || jumlah > 100_000_000_000) return Response.json({ error: "Jumlah harus lebih dari 0." }, { status: 400 });
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggal ?? "")) ? new Date(`${b.tanggal}T00:00:00Z`) : null;
    if (!tanggal) return Response.json({ error: "Tanggal belum diisi." }, { status: 400 });
    const r = await prisma.alokasiRencana.findUnique({ where: { id }, select: { angkatan: { select: { id: true, nama: true } } } });
    if (!r) return Response.json({ error: "Rencana tidak ditemukan." }, { status: 404 });
    const angkatanId = b.angkatanId && r.angkatan.some(a => a.id === b.angkatanId) ? String(b.angkatanId) : null;
    const pos = String(b.pos ?? "").trim().slice(0, 80) || null;
    if (jenis === "MASUK" && !angkatanId) return Response.json({ error: "Pilih angkatan asal uang masuk." }, { status: 400 });
    if (jenis === "KELUAR" && !pos) return Response.json({ error: "Pilih pos yang dipakai." }, { status: 400 });
    const t = await prisma.alokasiTransaksi.create({
      data: { rencanaId: id, jenis, angkatanId, pos: jenis === "KELUAR" ? pos : null, tanggal, jumlah,
        keterangan: String(b.keterangan ?? "").trim().slice(0, 300) || null, dicatatOleh: s.name },
      select: { id: true },
    });
    const asal = jenis === "MASUK" ? r.angkatan.find(a => a.id === angkatanId)?.nama : pos;
    await logActivity(s, { action: "CREATE", entity: "AlokasiDana", entityId: id,
      description: `${jenis === "MASUK" ? "Mencatat uang masuk" : "Mencatat pengeluaran"} Rp${jumlah.toLocaleString("id-ID")} (${asal})` }).catch(() => {});
    return Response.json({ id: t.id }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Admin & Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
