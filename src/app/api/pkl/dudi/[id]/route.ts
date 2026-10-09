import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, sesiPkl, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";
import { isianDudi } from "@/lib/pkl-dudi";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const data = isianDudi(await req.json().catch(() => ({})));
    if (!data.name) return Response.json({ error: "Nama DUDI wajib diisi." }, { status: 400 });
    const lama = await prisma.industryPartner.findUnique({ where: { id }, select: { name: true } });
    if (!lama) return Response.json({ error: "DUDI tidak ditemukan." }, { status: 404 });
    const kembar = await prisma.industryPartner.findFirst({ where: { id: { not: id }, name: { equals: data.name, mode: "insensitive" } }, select: { id: true } });
    if (kembar) return Response.json({ error: `"${data.name}" sudah dipakai DUDI lain.` }, { status: 409 });
    await prisma.$transaction([
      // Usulan dari web dianggap SUDAH DIPERIKSA begitu Humas menyimpannya dalam keadaan aktif.
      prisma.industryPartner.update({ where: { id }, data: { ...data, ...(data.aktif === true ? { usulan: false } : {}) } }),
      // `Internship.company` adalah SALINAN nama DUDI — ikut diganti supaya layar & cetakan lama tidak menampilkan nama usang.
      ...(lama.name !== data.name ? [prisma.internship.updateMany({ where: { mitraId: id }, data: { company: data.name } })] : []),
    ]);
    await logActivity(session, { action: "UPDATE", entity: "IndustryPartner", entityId: id, description: `Mengubah data DUDI ${data.name}` }).catch(() => null);
    sinkronLatar(() => siswaDiDudi(id)); // nama / alamat / titik DUDI berubah → Buku Induk semua siswanya ikut
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPkl();
    const { id } = await params;
    const d = await prisma.industryPartner.findUnique({ where: { id }, select: { name: true, _count: { select: { internships: true } } } });
    if (!d) return Response.json({ error: "DUDI tidak ditemukan." }, { status: 404 });
    // DUDI yang pernah/sedang ditempati tidak dihapus — riwayat penempatan & rekapnya ikut hilang. Nonaktifkan saja.
    const riwayat = await prisma.mutasiPkl.count({ where: { OR: [{ dariMitraId: id }, { keMitraId: id }] } });
    if (d._count.internships > 0 || riwayat > 0) {
      return Response.json({ error: "DUDI ini punya riwayat penempatan siswa, jadi tidak bisa dihapus. Nonaktifkan saja supaya tidak muncul di pilihan penempatan." }, { status: 409 });
    }
    await prisma.industryPartner.delete({ where: { id } });
    await logActivity(session, { action: "DELETE", entity: "IndustryPartner", entityId: id, description: `Menghapus DUDI ${d.name}` }).catch(() => null);
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
