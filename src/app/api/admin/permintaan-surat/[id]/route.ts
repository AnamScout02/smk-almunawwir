import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { buatSuratDariPermohonan } from "@/lib/surat-dari-permohonan";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Setujui / tolak satu permintaan. `tipe` menentukan tabel mana yang disentuh
 * (SURAT = SuratKeterangan, LEGALISIR = LegalisirRequest). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();
    const setuju = b.keputusan === "DISETUJUI";
    if (!setuju && b.keputusan !== "DITOLAK") return Response.json({ error: "Keputusan tidak dikenal." }, { status: 400 });
    if (!setuju && !b.rejectReason?.trim()) return Response.json({ error: "Alasan penolakan wajib diisi." }, { status: 400 });

    const jejak = {
      requestStatus: setuju ? "DISETUJUI" : "DITOLAK",
      decidedById: session.userId,
      decidedAt: new Date(),
      rejectReason: setuju ? null : String(b.rejectReason).trim(),
    };

    if (b.tipe === "LEGALISIR") {
      const row = await prisma.legalisirRequest.update({
        where: { id },
        data: { ...jejak, ...(setuju ? {} : { status: "DIPROSES" }) },
      });
      return Response.json(row);
    }

    // Surat Keterangan: begitu DISETUJUI, permohonan ini langsung menjelma jadi surat keluar
    // biasa di Persuratan — nomor resmi terbit dari urutan yang sama dengan surat keluar lain,
    // isinya diambil dari template arsip sekolah dengan identitas siswa yang sudah terisi.
    // Tabel ini tinggal menyimpan riwayat permohonannya (keputusan user: "iya jangan dipisahkan").
    let suratId: string | null = null;
    if (setuju) {
      const current = await prisma.suratKeterangan.findUnique({
        where: { id },
        select: {
          id: true, jenis: true, tanggal: true, studentId: true, namaSiswa: true,
          nisSiswa: true, kelasSiswa: true, keperluan: true, tujuan: true, nomorSurat: true,
        },
      });
      if (!current) return Response.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
      suratId = await buatSuratDariPermohonan(current);
    }

    const row = await prisma.suratKeterangan.update({ where: { id }, data: jejak });
    return Response.json({ ...row, suratId: suratId ?? row.suratId });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memproses permintaan." }, { status: 500 });
  }
}
