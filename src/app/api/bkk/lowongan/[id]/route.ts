import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { kelolaBkk, rapikanLowongan } from "@/lib/bkk";

export const dynamic = "force-dynamic";

/** Detail lowongan + daftar siswa berminat (pengelola). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaBkk(session))) return Response.json({ error: "Khusus pengelola BKK." }, { status: 403 });
  const { id } = await params;
  const l = await prisma.lowonganKerja.findUnique({ where: { id }, include: { minat: { orderBy: { createdAt: "asc" } } } });
  if (!l) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const siswa = await prisma.student.findMany({
    where: { id: { in: l.minat.map(m => m.studentId) } },
    select: { id: true, nis: true, gender: true, user: { select: { name: true, email: true } }, class: { select: { name: true } }, bukuIndukData: true },
  });
  const peta = new Map(siswa.map(s => [s.id, s]));
  return Response.json({
    lowongan: { ...l, minat: undefined },
    peminat: l.minat.map(m => {
      const s = peta.get(m.studentId);
      const bi = (s?.bukuIndukData ?? {}) as Record<string, unknown>;
      return { studentId: m.studentId, status: m.status, catatan: m.catatan, pada: m.createdAt, nama: s?.user.name ?? "-", nis: s?.nis ?? "", kelas: s?.class?.name ?? "", email: s?.user.email ?? "", hp: typeof bi.studentPhone === "string" ? bi.studentPhone : "" };
    }),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaBkk(session))) return Response.json({ error: "Khusus pengelola BKK." }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (Object.keys(b).length === 1 && typeof b.aktif === "boolean") {
    await prisma.lowonganKerja.update({ where: { id }, data: { aktif: b.aktif } });
    return Response.json({ ok: true });
  }
  const d = rapikanLowongan(b);
  if (!d.judul || !d.perusahaan || !d.kualifikasi) return Response.json({ error: "Posisi, perusahaan, dan kualifikasi wajib diisi." }, { status: 400 });
  await prisma.lowonganKerja.update({ where: { id }, data: d });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaBkk(session))) return Response.json({ error: "Khusus pengelola BKK." }, { status: 403 });
  const { id } = await params;
  await prisma.lowonganKerja.delete({ where: { id } });
  return Response.json({ ok: true });
}
