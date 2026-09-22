import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const include = {
  teacher: { select: { id: true, nip: true, position: true, user: { select: { name: true } } } },
} as const;

/** `?year=YYYY` menyaring per tahun takwim (dipakai untuk hitung sisa kuota cuti tahunan). */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const year = new URL(req.url).searchParams.get("year");
    const where = year && /^\d{4}$/.test(year)
      ? { startDate: { gte: new Date(Number(year), 0, 1), lt: new Date(Number(year) + 1, 0, 1) } }
      : {};
    const rows = await prisma.staffLeave.findMany({
      where, include, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat data cuti" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.teacherId) return Response.json({ error: "Pegawai wajib dipilih." }, { status: 400 });
    if (!b.startDate || !b.endDate) return Response.json({ error: "Tanggal mulai & selesai wajib diisi." }, { status: 400 });
    if (!b.reason?.trim()) return Response.json({ error: "Alasan cuti wajib diisi." }, { status: 400 });

    const row = await prisma.staffLeave.create({
      data: {
        teacherId: b.teacherId,
        jenis: b.jenis || "TAHUNAN",
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        days: Number(b.days) > 0 ? Number(b.days) : 1,
        reason: b.reason.trim(),
        status: b.status || "DIAJUKAN",
        approvedBy: b.approvedBy?.trim() || null,
        approvedAt: b.status === "DISETUJUI" ? new Date() : null,
        attachmentUrl: b.attachmentUrl || null,
        notes: b.notes?.trim() || null,
        inputById: session.userId,
      },
      include,
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan pengajuan cuti." }, { status: 500 });
  }
}
