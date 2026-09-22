import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { bolehAturUjian, ringkasKegiatan, SELECT_KEGIATAN } from "@/lib/kegiatan-ujian-server";
import { bacaIsianKegiatan } from "@/lib/kegiatan-ujian-input";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DILARANG = { error: "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur kegiatan ujian." };

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json(DILARANG, { status: 403 });
    const { id } = await params;
    const { data, error } = bacaIsianKegiatan(await req.json(), true);
    if (error) return Response.json({ error }, { status: 400 });
    const ada = await prisma.kegiatanUjian.findUnique({ where: { id }, select: { id: true } });
    if (!ada) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    const k = await prisma.kegiatanUjian.update({ where: { id }, data: data as never, select: SELECT_KEGIATAN });
    await logActivity(session, { action: "UBAH_KEGIATAN_UJIAN", entity: "KegiatanUjian", entityId: id, description: `Mengubah kegiatan ujian "${k.nama}"` });
    return Response.json(ringkasKegiatan(k));
  } catch {
    return Response.json({ error: "Gagal menyimpan kegiatan ujian." }, { status: 500 });
  }
}

/** Kegiatan yang sudah dipakai ujian TIDAK dihapus — nama kegiatan melekat di riwayat ujian &
 * nilai siswa. Yang benar untuk kegiatan yang sudah lewat adalah menonaktifkannya. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json(DILARANG, { status: 403 });
    const { id } = await params;
    const k = await prisma.kegiatanUjian.findUnique({ where: { id }, select: { nama: true, _count: { select: { exams: true } } } });
    if (!k) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    if (k._count.exams > 0) {
      return Response.json({ error: `"${k.nama}" sudah dipakai ${k._count.exams} ujian — nonaktifkan saja supaya riwayat ujian tetap bernama.` }, { status: 409 });
    }
    await prisma.kegiatanUjian.delete({ where: { id } });
    await logActivity(session, { action: "HAPUS_KEGIATAN_UJIAN", entity: "KegiatanUjian", entityId: id, description: `Menghapus kegiatan ujian "${k.nama}"` });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus kegiatan ujian." }, { status: 500 });
  }
}
