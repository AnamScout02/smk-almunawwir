import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { assertPengelolaOsis, statusEfektif } from "@/lib/osis-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

type Calon = { nomor: number; ketua: string; wakil?: string; kelas?: string; foto?: string; visi: string; misi: string };
const tolak = (e: unknown) => e instanceof Error && e.message === "FORBIDDEN"
  ? Response.json({ error: "Khusus Pembina OSIS, Kesiswaan, dan Admin." }, { status: 403 })
  : Response.json({ error: "Gagal memproses." }, { status: 500 });

/** Detail pemilihan + hasil (jumlah suara per calon, partisipasi per kelas). Pengelola saja. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPengelolaOsis(session);
    const { id } = await params;
    const p = await prisma.pemilihanOsis.findUnique({
      where: { id },
      include: { calon: { orderBy: { nomor: "asc" }, include: { _count: { select: { suara: true } } } } },
    });
    if (!p) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
    const [kelas, hakPilih, sudah] = await Promise.all([
      prisma.class.findMany({ where: p.kelasIds.length ? { id: { in: p.kelasIds } } : undefined, select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
      prisma.student.groupBy({ by: ["classId"], where: { studentStatus: "AKTIF", classId: p.kelasIds.length ? { in: p.kelasIds } : { not: null } }, _count: true }),
      prisma.pemilihOsis.groupBy({ by: ["classId"], where: { pemilihanId: id }, _count: true }),
    ]);
    const semuaKelas = await prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] });
    return Response.json({
      ...p, statusEfektif: statusEfektif(p), semuaKelas,
      calon: p.calon.map(c => ({ ...c, suara: c._count.suara, _count: undefined })),
      partisipasi: kelas.map(k => ({
        kelas: k.name,
        hakPilih: hakPilih.find(h => h.classId === k.id)?._count ?? 0,
        memilih: sudah.find(s => s.classId === k.id)?._count ?? 0,
      })),
    });
  } catch (e) { lemparBilaPengalihan(e); return tolak(e); }
}

/** Ubah pengaturan/calon (hanya DRAF), atau buka/tutup. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPengelolaOsis(session);
    const { id } = await params;
    const p = await prisma.pemilihanOsis.findUnique({ where: { id }, include: { _count: { select: { pemilih: true, calon: true } } } });
    if (!p) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
    const b = await req.json().catch(() => ({})) as { judul?: string; mulai?: string; selesai?: string; kelasIds?: string[]; calon?: Calon[]; status?: string };
    if (b.status) {
      if (!["DRAF", "BUKA", "TUTUP"].includes(b.status)) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
      if (b.status === "BUKA" && p._count.calon < 1) return Response.json({ error: "Tambahkan calon dulu." }, { status: 400 });
      if (b.status === "DRAF" && p._count.pemilih > 0) return Response.json({ error: "Sudah ada suara masuk — tidak bisa dikembalikan ke draf." }, { status: 409 });
      await prisma.pemilihanOsis.update({ where: { id }, data: { status: b.status } });
      await logActivity(session, { action: "PEMILIHAN_OSIS", entity: "PemilihanOsis", entityId: id, description: `Status pemilihan "${p.judul}" → ${b.status}` }).catch(() => {});
      return Response.json({ ok: true });
    }
    if (p.status !== "DRAF") return Response.json({ error: "Pengaturan hanya bisa diubah selama draf." }, { status: 409 });
    const data: Record<string, unknown> = {};
    if (b.judul) data.judul = b.judul.trim().slice(0, 150);
    if (b.mulai) data.mulai = new Date(b.mulai);
    if (b.selesai) data.selesai = new Date(b.selesai);
    if (Array.isArray(b.kelasIds)) data.kelasIds = b.kelasIds.filter(x => typeof x === "string");
    await prisma.$transaction(async tx => {
      await tx.pemilihanOsis.update({ where: { id }, data });
      if (Array.isArray(b.calon)) {
        await tx.calonOsis.deleteMany({ where: { pemilihanId: id } });
        for (const [i, c] of b.calon.entries()) {
          if (!c.ketua?.trim() || !c.visi?.trim()) continue;
          await tx.calonOsis.create({ data: {
            pemilihanId: id, nomor: Number(c.nomor) || i + 1, ketua: c.ketua.trim().slice(0, 100), wakil: c.wakil?.trim().slice(0, 100) || null,
            kelas: c.kelas?.trim().slice(0, 50) || null, foto: c.foto || null, visi: c.visi.trim().slice(0, 1000), misi: (c.misi ?? "").trim().slice(0, 3000),
          } });
        }
      }
    });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return tolak(e); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPengelolaOsis(session);
    const { id } = await params;
    const p = await prisma.pemilihanOsis.findUnique({ where: { id }, include: { _count: { select: { pemilih: true } } } });
    if (!p) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
    if (p._count.pemilih > 0) return Response.json({ error: "Pemilihan yang sudah memiliki suara tidak bisa dihapus." }, { status: 409 });
    await prisma.pemilihanOsis.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return tolak(e); }
}
