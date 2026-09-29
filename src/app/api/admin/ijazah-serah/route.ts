import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const INCLUDE = {
  student: {
    select: {
      id: true, nis: true, nisn: true, enrollYear: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      major: { select: { code: true, name: true } },
    },
  },
};

/** Buku Penyerahan Ijazah. `?year=YYYY` menyaring per tahun penyerahan (dipakai halaman cetak). */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const year = new URL(req.url).searchParams.get("year");
    let where = {};
    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      where = { tanggalSerah: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } };
    }
    const rows = await prisma.ijazahHandover.findMany({
      where, include: INCLUDE,
      orderBy: [{ tanggalSerah: "desc" }, { createdAt: "desc" }],
      ...(year ? {} : { take: 300 }),
    });
    return Response.json(rows);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat buku penyerahan ijazah" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.studentId) return Response.json({ error: "Alumni wajib dipilih." }, { status: 400 });
    if (!b.pengambilNama?.trim()) return Response.json({ error: "Nama pengambil wajib diisi." }, { status: 400 });

    const dokumen: string[] = Array.isArray(b.dokumen) ? b.dokumen.filter(Boolean) : [];
    if (dokumen.length === 0) return Response.json({ error: "Pilih minimal satu dokumen yang diserahkan." }, { status: 400 });

    const row = await prisma.ijazahHandover.create({
      data: {
        studentId: b.studentId,
        dokumen,
        nomorIjazah: b.nomorIjazah?.trim() || null,
        tanggalSerah: b.tanggalSerah ? new Date(b.tanggalSerah) : new Date(),
        diambilOleh: b.diambilOleh || "SENDIRI",
        pengambilNama: b.pengambilNama.trim(),
        pengambilHubungan: b.pengambilHubungan?.trim() || null,
        pengambilNik: b.pengambilNik?.trim() || null,
        pengambilPhone: b.pengambilPhone?.trim() || null,
        petugas: b.petugas?.trim() || null,
        keterangan: b.keterangan?.trim() || null,
        inputById: session.userId,
      },
      include: INCLUDE,
    });
    return Response.json(row, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan penyerahan ijazah." }, { status: 500 });
  }
}
