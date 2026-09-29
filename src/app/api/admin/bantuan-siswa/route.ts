import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { code: true } } } },
} as const;

/** `?year=YYYY` menyaring per tahun anggaran (default: semua, 300 terbaru). */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const year = new URL(req.url).searchParams.get("year");
    const where = year && /^\d{4}$/.test(year) ? { tahun: Number(year) } : {};
    const rows = await prisma.bantuanSiswa.findMany({
      where, include, orderBy: [{ tahun: "desc" }, { createdAt: "desc" }], take: year ? undefined : 300,
    });
    return Response.json(rows);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat data bantuan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.studentId) return Response.json({ error: "Siswa wajib dipilih." }, { status: 400 });

    const row = await prisma.bantuanSiswa.create({
      data: {
        studentId: b.studentId,
        jenis: b.jenis || "PIP",
        tahun: Number(b.tahun) || new Date().getFullYear(),
        tahap: b.tahap?.trim() || null,
        nominal: Number(b.nominal) || 0,
        noSk: b.noSk?.trim() || null,
        tanggalCair: b.tanggalCair ? new Date(b.tanggalCair) : null,
        bank: b.bank?.trim() || null,
        noRekening: b.noRekening?.trim() || null,
        statusAmbil: b.statusAmbil || "BELUM",
        tanggalAmbil: b.tanggalAmbil ? new Date(b.tanggalAmbil) : null,
        diambilOleh: b.diambilOleh?.trim() || null,
        catatan: b.catatan?.trim() || null,
        inputById: session.userId,
      },
      include,
    });
    return Response.json(row, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan data bantuan." }, { status: 500 });
  }
}
