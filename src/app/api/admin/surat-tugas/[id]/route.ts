import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const INCLUDE = {
  pegawai: {
    orderBy: { urutan: "asc" as const },
    include: { teacher: { select: { id: true, nip: true, user: { select: { name: true } } } } },
  },
};

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const b = await req.json();

    const data: Record<string, unknown> = {};
    if ("nomor" in b) data.nomor = String(b.nomor).trim();
    if ("tanggal" in b) data.tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    if ("dasar" in b) data.dasar = b.dasar?.trim() || null;
    if ("maksud" in b) data.maksud = String(b.maksud).trim();
    if ("tempat" in b) data.tempat = String(b.tempat).trim();
    if ("tempat2" in b) data.tempat2 = b.tempat2?.trim() || null;
    if ("tempat3" in b) data.tempat3 = b.tempat3?.trim() || null;
    if ("jam" in b) data.jam = b.jam?.trim() || null;
    if ("tanggalBerangkat" in b) data.tanggalBerangkat = new Date(b.tanggalBerangkat);
    if ("tanggalKembali" in b) data.tanggalKembali = new Date(b.tanggalKembali);
    if ("transportasi" in b) data.transportasi = b.transportasi?.trim() || null;
    if ("sumberBiaya" in b) data.sumberBiaya = b.sumberBiaya || null;
    if ("instansi" in b) data.instansi = b.instansi?.trim() || null;
    if ("biayaAnggaran" in b) data.biayaAnggaran = b.biayaAnggaran?.trim() || null;
    if ("withSppd" in b) data.withSppd = Boolean(b.withSppd);
    if ("withLaporan" in b) data.withLaporan = Boolean(b.withLaporan);
    if ("hasilLaporan" in b) {
      data.hasilLaporan = b.hasilLaporan?.trim() || null;
      // Tanggal laporan terisi sendiri saat hasilnya pertama kali ditulis — bukan kolom terpisah
      // yang harus diingat petugas.
      data.tanggalLaporan = b.hasilLaporan?.trim() ? new Date() : null;
    }
    if ("penandaTangan" in b) data.penandaTangan = b.penandaTangan?.trim() || null;
    if ("keterangan" in b) data.keterangan = b.keterangan?.trim() || null;

    // Daftar pegawai diganti utuh (hapus lalu tulis ulang), bukan di-diff satu per satu:
    // urutannya bermakna di surat cetak, dan jumlahnya selalu kecil (1-10 orang).
    if (Array.isArray(b.pegawai)) {
      type P = { teacherId?: string; nama: string; nip?: string; jabatan?: string; keterangan?: string };
      const saring = (arr: unknown): P[] => Array.isArray(arr) ? arr.filter((p: { nama?: string }) => p?.nama?.trim()) : [];
      const pegawai = saring(b.pegawai);
      const pengikut = saring(b.pengikut);
      if (pegawai.length === 0) return Response.json({ error: "Minimal satu pegawai yang ditugaskan." }, { status: 400 });
      const baris = (p: P, i: number, peran: string) => ({
        suratTugasId: id,
        teacherId: p.teacherId || null,
        nama: String(p.nama).trim(),
        nip: p.nip?.trim() || null,
        jabatan: p.jabatan?.trim() || null,
        peran,
        keterangan: p.keterangan?.trim() || null,
        urutan: (peran === "PENGIKUT" ? 100 : 0) + i,
      });
      await prisma.$transaction([
        prisma.suratTugasPegawai.deleteMany({ where: { suratTugasId: id } }),
        prisma.suratTugasPegawai.createMany({
          data: [
            ...pegawai.map((p, i) => baris(p, i, "PELAKSANA")),
            ...pengikut.map((p, i) => baris(p, i, "PENGIKUT")),
          ],
        }),
      ]);
    }

    const row = await prisma.suratTugas.update({ where: { id }, data, include: INCLUDE });
    return Response.json(row);
  } catch {
    return Response.json({ error: "Gagal memperbarui surat tugas." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.suratTugas.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus surat tugas." }, { status: 500 });
  }
}
