import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** Sama seperti presensi pegawai: kolom tanggal bertipe DATE, server UTC, sekolah WIB —
 * tanggal dibentuk eksplisit dari string "YYYY-MM-DD" supaya tidak pernah bergeser sehari. */
const tanggalUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const isTanggal = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const academicYearId = new URL(req.url).searchParams.get("academicYearId");
    const rows = await prisma.schoolEvent.findMany({
      where: academicYearId ? { academicYearId } : {},
      include: { academicYear: { select: { id: true, name: true } } },
      orderBy: [{ tanggalMulai: "asc" }],
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat kalender pendidikan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.judul?.trim()) return Response.json({ error: "Nama kegiatan wajib diisi." }, { status: 400 });
    if (!isTanggal(b.tanggalMulai)) return Response.json({ error: "Tanggal mulai wajib diisi." }, { status: 400 });
    const selesai = isTanggal(b.tanggalSelesai) ? b.tanggalSelesai : b.tanggalMulai;
    if (selesai < b.tanggalMulai) return Response.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });

    const row = await prisma.schoolEvent.create({
      data: {
        judul: b.judul.trim(),
        tanggalMulai: tanggalUtc(b.tanggalMulai),
        tanggalSelesai: tanggalUtc(selesai),
        jenis: b.jenis || "KEGIATAN",
        keterangan: b.keterangan?.trim() || null,
        hariEfektif: Boolean(b.hariEfektif),
        tampilPublik: b.tampilPublik !== false,
        academicYearId: b.academicYearId || null,
        inputById: session.userId,
      },
      include: { academicYear: { select: { id: true, name: true } } },
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan agenda." }, { status: 500 });
  }
}
