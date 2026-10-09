import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { kirimLatar } from "@/lib/push-server";
import { kabariTujuanDisposisi } from "@/lib/disposisi-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar disposisi. `?status=` menyaring per status, `?suratId=` untuk satu surat saja.
 * Tanpa parameter: 200 terbaru (halaman tidak perlu memuat riwayat bertahun-tahun sekaligus). */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const q = new URL(req.url).searchParams;
    const status = q.get("status");
    const suratId = q.get("suratId");

    const rows = await prisma.disposisi.findMany({
      where: { ...(status ? { status } : {}), ...(suratId ? { suratId } : {}) },
      include: { surat: { select: { id: true, nomor: true, tanggal: true, pihak: true, perihal: true, fileUrl: true } } },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: suratId ? undefined : 200,
    });
    return Response.json(rows);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat disposisi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.suratId) return Response.json({ error: "Surat wajib dipilih." }, { status: 400 });
    if (!b.instruksi?.trim()) return Response.json({ error: "Isi instruksi wajib diisi." }, { status: 400 });

    const tujuan: string[] = Array.isArray(b.tujuan) ? b.tujuan.map((t: string) => String(t).trim()).filter(Boolean) : [];
    if (tujuan.length === 0) return Response.json({ error: "Tujuan disposisi wajib dipilih minimal satu." }, { status: 400 });

    const row = await prisma.disposisi.create({
      data: {
        suratId: b.suratId,
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
        tujuan,
        instruksi: b.instruksi.trim(),
        sifat: b.sifat || "BIASA",
        batasWaktu: b.batasWaktu ? new Date(b.batasWaktu) : null,
        dariNama: b.dariNama?.trim() || null,
        inputById: session.userId,
      },
      include: { surat: { select: { id: true, nomor: true, tanggal: true, pihak: true, perihal: true, fileUrl: true } } },
    });
    // Surat yang sudah didisposisikan otomatis dianggap sudah dibaca — kalau tidak, lencana
    // "surat masuk belum dibaca" di sidebar tetap menyala padahal sudah ditindaklanjuti.
    await prisma.surat.update({ where: { id: b.suratId }, data: { isRead: true } }).catch(() => {});
    // Kabari yang dituju — satu sumber dengan disposisi pimpinan dari HP (src/lib/disposisi-server.ts).
    kirimLatar(() => kabariTujuanDisposisi(row));
    return Response.json(row, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan disposisi." }, { status: 500 });
  }
}
