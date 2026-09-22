import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hakPengumuman, penerimaPengumuman } from "@/lib/pengumuman";

export const dynamic = "force-dynamic";

/** Statistik pembaca: siapa sudah & belum menandai dibaca, dikelompokkan per peran (dan kelas untuk siswa/orang tua). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const hak = await hakPengumuman(session);
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id }, include: { dibaca: { select: { userId: true, dibacaAt: true } } } });
  if (!hak.boleh || !a || (!hak.semua && a.pembuatId !== session.userId)) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const sasaran = await penerimaPengumuman(a);
  const waktu = new Map(a.dibaca.map(d => [d.userId, d.dibacaAt]));
  const users = await prisma.user.findMany({
    where: { id: { in: sasaran.map(s => s.userId) } },
    select: {
      id: true, name: true,
      student: { select: { class: { select: { name: true } } } },
      parent: { select: { children: { select: { student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } }, take: 3 } } },
    },
  });
  const peta = new Map(users.map(u => [u.id, u]));
  const baris = sasaran.map(s => {
    const u = peta.get(s.userId);
    const ket = u?.student?.class?.name
      ?? (u?.parent ? u.parent.children.map(c => `${c.student.user.name} (${c.student.class?.name ?? "-"})`).join(", ") : "");
    return { nama: u?.name ?? "-", peran: s.peran, keterangan: ket, dibacaAt: waktu.get(s.userId) ?? null };
  }).sort((x, y) => Number(!!y.dibacaAt) - Number(!!x.dibacaAt) || x.peran.localeCompare(y.peran) || x.keterangan.localeCompare(y.keterangan) || x.nama.localeCompare(y.nama));
  return Response.json({ judul: a.title, total: baris.length, dibaca: baris.filter(b => b.dibacaAt).length, baris });
}
