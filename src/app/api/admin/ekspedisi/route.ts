import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** Buku Ekspedisi. `?month=YYYY-MM` untuk rekap bulanan (dipakai halaman cetak). */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const month = new URL(req.url).searchParams.get("month");

    let where = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      where = { tanggal: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    const rows = await prisma.ekspedisi.findMany({
      where,
      include: { surat: { select: { id: true, nomor: true, perihal: true } } },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      ...(month ? {} : { take: 300 }),
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat buku ekspedisi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.perihal?.trim()) return Response.json({ error: "Perihal wajib diisi." }, { status: 400 });
    if (!b.tujuan?.trim()) return Response.json({ error: "Tujuan wajib diisi." }, { status: 400 });

    const row = await prisma.ekspedisi.create({
      data: {
        tanggal: b.tanggal ? new Date(b.tanggal) : new Date(),
        suratId: b.suratId || null,
        nomorSurat: b.nomorSurat?.trim() || null,
        perihal: b.perihal.trim(),
        tujuan: b.tujuan.trim(),
        alamatTujuan: b.alamatTujuan?.trim() || null,
        jumlah: Number(b.jumlah) > 0 ? Number(b.jumlah) : 1,
        caraKirim: b.caraKirim || "LANGSUNG",
        petugas: b.petugas?.trim() || null,
        keterangan: b.keterangan?.trim() || null,
        inputById: session.userId,
      },
      include: { surat: { select: { id: true, nomor: true, perihal: true } } },
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan catatan ekspedisi." }, { status: 500 });
  }
}
