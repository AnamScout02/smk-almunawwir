import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar kunjungan tamu. `?month=YYYY-MM` menyaring per bulan (dipakai halaman utama & cetak
 * rekap bulanan) — tanpa parameter, kembalikan 300 terakhir supaya halaman tidak berat kalau
 * sudah bertahun-tahun terisi. */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const month = new URL(req.url).searchParams.get("month");

    let where = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      where = { visitDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    const entries = await prisma.guestBookEntry.findMany({
      where,
      include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
      ...(month ? {} : { take: 300 }),
    });
    return Response.json(entries);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat buku tamu" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.guestName?.trim()) return Response.json({ error: "Nama tamu wajib diisi." }, { status: 400 });
    if (!b.purpose?.trim()) return Response.json({ error: "Keperluan wajib diisi." }, { status: 400 });

    const entry = await prisma.guestBookEntry.create({
      data: {
        visitDate: b.visitDate ? new Date(b.visitDate) : new Date(),
        timeIn: b.timeIn || null,
        timeOut: b.timeOut || null,
        guestName: b.guestName.trim(),
        category: b.category || "UMUM",
        institution: b.institution?.trim() || null,
        studentId: b.studentId || null,
        purpose: b.purpose.trim(),
        metWith: b.metWith?.trim() || null,
        phone: b.phone?.trim() || null,
        notes: b.notes?.trim() || null,
        inputById: session.userId,
      },
      include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    });
    return Response.json(entry, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan kunjungan." }, { status: 500 });
  }
}
