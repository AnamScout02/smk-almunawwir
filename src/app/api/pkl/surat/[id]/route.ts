import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";
import { isianDariSurat, siapkanSuratPkl } from "@/lib/pkl-surat-server";
import type { JenisSuratPkl } from "@/lib/pkl-surat";

export const dynamic = "force-dynamic";

/** Isian satu surat PKL untuk formulir Ubah. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await sesiPkl();
    const { id } = await params;
    const t = await prisma.suratPkl.findUnique({ where: { id } });
    if (!t) return Response.json({ error: "Surat tidak ditemukan." }, { status: 404 });
    return Response.json({ id: t.id, nomor: t.nomor, isian: await isianDariSurat(t) });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** UBAH surat PKL. Nomor & jenis TETAP (kode klasifikasi ada di dalam nomor); isinya disusun ulang dari isian baru —
 *  jadi kalimat yang pernah disunting tangan di Persuratan ikut tergantikan. Layar memperingatkannya sebelum menyimpan. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const t = await prisma.suratPkl.findUnique({ where: { id } });
    if (!t) return Response.json({ error: "Surat tidak ditemukan." }, { status: 404 });
    const x = await siapkanSuratPkl(await req.json().catch(() => ({})), t.jenis as JenisSuratPkl);
    if ("galat" in x) return Response.json({ error: x.galat }, { status: x.status });
    await prisma.$transaction(async tx => {
      if (x.tugas && t.suratTugasId) {
        await tx.suratTugasPegawai.deleteMany({ where: { suratTugasId: t.suratTugasId } });
        await tx.suratTugas.update({ where: { id: t.suratTugasId }, data: { tanggal: x.tanggal, ...x.tugas.data, pegawai: { create: x.tugas.pegawai } } });
      } else if (x.surat && t.suratId) {
        await tx.surat.update({ where: { id: t.suratId }, data: { tanggal: x.tanggal, perihal: x.perihal, ...x.surat } });
      }
      await tx.suratPkl.update({ where: { id }, data: { perihal: x.perihal, mitraIds: x.isian.mitraIds, namaMitra: x.namaMitra, studentIds: x.isian.studentIds, data: x.isian } });
    });
    await logActivity(session, { action: "UPDATE", entity: "SuratPkl", entityId: id, description: `Mengubah surat PKL ${t.nomor}: ${x.perihal} — ${x.namaMitra}` }).catch(() => null);
    return Response.json({ id, nomor: t.nomor });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** HAPUS surat PKL beserta suratnya di buku agenda TU (Surat / Surat Tugas). Nomornya kembali bebas hanya bila ini
 *  nomor TERAKHIR; menghapus nomor di tengah meninggalkan celah di urutan — layar menyebutkannya sebelum menghapus. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const t = await prisma.suratPkl.findUnique({ where: { id } });
    if (!t) return Response.json({ error: "Surat tidak ditemukan." }, { status: 404 });
    await prisma.$transaction(async tx => {
      if (t.suratTugasId) await tx.suratTugas.deleteMany({ where: { id: t.suratTugasId } });
      if (t.suratId) await tx.surat.deleteMany({ where: { id: t.suratId } });
      await tx.suratPkl.delete({ where: { id } });
    });
    await logActivity(session, { action: "DELETE", entity: "SuratPkl", entityId: id, description: `Menghapus surat PKL ${t.nomor}: ${t.perihal} — ${t.namaMitra}` }).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
