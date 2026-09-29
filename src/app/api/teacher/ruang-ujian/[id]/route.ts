import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { bacaRuang } from "@/lib/denah-ruang";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const TOLAK = "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur ruang ujian.";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: TOLAK }, { status: 403 });
    const { id } = await params;
    if (!(await prisma.ruangUjian.findUnique({ where: { id }, select: { id: true } }))) return Response.json({ error: "Ruang tidak ditemukan." }, { status: 404 });
    const d = bacaRuang(await req.json().catch(() => ({})));
    if ("error" in d) return Response.json({ error: d.error }, { status: 400 });
    const bentrok = await prisma.ruangUjian.findUnique({ where: { nama: d.nama }, select: { id: true } });
    if (bentrok && bentrok.id !== id) return Response.json({ error: `Ruang "${d.nama}" sudah ada.` }, { status: 409 });
    const terjauh = await prisma.penempatanRuangUjian.aggregate({ where: { ruangId: id }, _max: { kursi: true } });
    if ((terjauh._max.kursi ?? 0) > d.kapasitas) {
      return Response.json({ error: `Kursi nomor ${terjauh._max.kursi} di ruang ini sudah terisi — kapasitas tidak bisa di bawah itu. Bagikan ulang atau pindahkan pesertanya dulu.` }, { status: 409 });
    }
    return Response.json(await prisma.ruangUjian.update({ where: { id }, data: d }));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui ruang." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: TOLAK }, { status: 403 });
    const { id } = await params;
    const dipakai = await prisma.penempatanRuangUjian.count({ where: { ruangId: id } });
    if (dipakai > 0) {
      return Response.json({ error: `Ruang ini masih dipakai ${dipakai} peserta dalam pembagian ruang. Kosongkan atau bagikan ulang tanpa ruang ini dulu — atau nonaktifkan saja.` }, { status: 409 });
    }
    await prisma.ruangUjian.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus ruang." }, { status: 500 });
  }
}
