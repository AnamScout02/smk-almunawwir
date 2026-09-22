import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
  academicYear: { select: { id: true, name: true } },
} as const;

/** `?academicYearId=&semester=` — dipakai halaman utama utk menampilkan satu periode rapor,
 * sekaligus dasar menghitung siapa yang BELUM mengambil. */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const sp = new URL(req.url).searchParams;
    const academicYearId = sp.get("academicYearId");
    const semester = sp.get("semester");
    const where: Record<string, unknown> = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (semester) where.semester = semester;
    const rows = await prisma.raporHandover.findMany({
      where, include, orderBy: [{ tanggalAmbil: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat data penerimaan rapor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.studentId) return Response.json({ error: "Siswa wajib dipilih." }, { status: 400 });
    if (!b.diambilOleh?.trim()) return Response.json({ error: "Nama pengambil wajib diisi." }, { status: 400 });

    const row = await prisma.raporHandover.create({
      data: {
        studentId: b.studentId,
        academicYearId: b.academicYearId || null,
        semester: b.semester || "GANJIL",
        tanggalAmbil: b.tanggalAmbil ? new Date(b.tanggalAmbil) : new Date(),
        diambilOleh: b.diambilOleh.trim(),
        hubungan: b.hubungan?.trim() || null,
        phone: b.phone?.trim() || null,
        catatan: b.catatan?.trim() || null,
        inputById: session.userId,
      },
      include,
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan penerimaan rapor." }, { status: 500 });
  }
}
