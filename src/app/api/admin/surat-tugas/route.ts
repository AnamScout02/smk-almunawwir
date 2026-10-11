import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const INCLUDE = {
  pegawai: {
    orderBy: { urutan: "asc" as const },
    include: { teacher: { select: { id: true, nip: true, user: { select: { name: true } } } } },
  },
};

/** Klasifikasi arsip untuk surat tugas mengikuti kode yang dipakai modul Persuratan. */
// Arsip surat sekolah memakai B.5 untuk Surat Tugas/Mandat DAN SPPD (mis. 002/B.5, 011/B.5,
// 431/B.5). B.4 adalah kode Surat Undangan — sempat terpakai keliru sampai 13 September 2026.
const KLASIFIKASI_SURAT_TUGAS = "B.5";

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const year = new URL(req.url).searchParams.get("year");
    let where = {};
    if (year && /^\d{4}$/.test(year)) {
      const y = Number(year);
      where = { tanggal: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } };
    }
    const rows = await prisma.suratTugas.findMany({
      where, include: INCLUDE,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      ...(year ? {} : { take: 200 }),
    });
    // Cuti/surat tugas ↔ Presensi Pegawai (src/lib/presensi-turunan.ts) — di latar, gagal di sini tidak menggagalkan simpan.
    void import("@/lib/presensi-turunan").then(m => m.sinkronPresensiDokumenBaku()).catch(() => null);
    return Response.json(rows);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat surat tugas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.maksud?.trim()) return Response.json({ error: "Maksud penugasan wajib diisi." }, { status: 400 });
    if (!b.tempat?.trim()) return Response.json({ error: "Tempat pelaksanaan wajib diisi." }, { status: 400 });

    type PegawaiInput = { teacherId?: string | null; nama: string; nip?: string | null; jabatan?: string | null; peran?: string; keterangan?: string | null };
    const bersih = (arr: unknown): PegawaiInput[] =>
      Array.isArray(arr) ? arr.filter((p: { nama?: string }) => p?.nama?.trim()) : [];
    const pegawai = bersih(b.pegawai);
    const pengikut = bersih(b.pengikut);
    if (pegawai.length === 0) return Response.json({ error: "Minimal satu pegawai yang ditugaskan." }, { status: 400 });

    const tanggal = b.tanggal ? new Date(b.tanggal) : new Date();
    const berangkat = b.tanggalBerangkat ? new Date(b.tanggalBerangkat) : tanggal;
    const kembali = b.tanggalKembali ? new Date(b.tanggalKembali) : berangkat;
    if (kembali < berangkat) return Response.json({ error: "Tanggal kembali tidak boleh sebelum tanggal berangkat." }, { status: 400 });

    // Nomor mengikuti SATU urutan surat keluar sekolah, sama dengan Persuratan & Surat Keterangan.
    const nomor = b.nomor?.trim() || await nomorSuratBerikutnya(KLASIFIKASI_SURAT_TUGAS, tanggal);

    const row = await prisma.suratTugas.create({
      data: {
        nomor, tanggal,
        dasar: b.dasar?.trim() || null,
        maksud: b.maksud.trim(),
        tempat: b.tempat.trim(),
        tempat2: b.tempat2?.trim() || null,
        tempat3: b.tempat3?.trim() || null,
        jam: b.jam?.trim() || null,
        tanggalBerangkat: berangkat,
        tanggalKembali: kembali,
        transportasi: b.transportasi?.trim() || null,
        sumberBiaya: b.sumberBiaya || null,
        instansi: b.instansi?.trim() || null,
        biayaAnggaran: b.biayaAnggaran?.trim() || null,
        withSppd: Boolean(b.withSppd),
        withLaporan: Boolean(b.withLaporan),
        hasilLaporan: b.hasilLaporan?.trim() || null,
        penandaTangan: b.penandaTangan?.trim() || null,
        keterangan: b.keterangan?.trim() || null,
        inputById: session.userId,
        pegawai: {
          create: [
            ...pegawai.map((p, i) => ({
              teacherId: p.teacherId || null,
              nama: String(p.nama).trim(),
              nip: p.nip?.trim() || null,
              jabatan: p.jabatan?.trim() || null,
              peran: "PELAKSANA",
              keterangan: p.keterangan?.trim() || null,
              urutan: i,
            })),
            ...pengikut.map((p, i) => ({
              teacherId: p.teacherId || null,
              nama: String(p.nama).trim(),
              nip: p.nip?.trim() || null,
              jabatan: p.jabatan?.trim() || null,
              peran: "PENGIKUT",
              keterangan: p.keterangan?.trim() || null,
              urutan: 100 + i,
            })),
          ],
        },
      },
      include: INCLUDE,
    });
    return Response.json(row, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    const msg = e instanceof Error && e.message.includes("Unique") ? "Nomor surat sudah dipakai." : "Gagal menyimpan surat tugas.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
