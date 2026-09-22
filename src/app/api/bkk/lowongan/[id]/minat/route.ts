import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { kelolaBkk, pembacaLowongan, STATUS_MINAT } from "@/lib/bkk";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Siswa XII menyatakan berminat (POST) atau membatalkan (DELETE); pengelola memperbarui status (PATCH). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["STUDENT"]);
  const saya = await pembacaLowongan(session);
  if (!saya) return Response.json({ error: "Khusus siswa kelas XII." }, { status: 403 });
  const { id } = await params;
  const l = await prisma.lowonganKerja.findFirst({ where: { id, aktif: true, OR: [{ batas: null }, { batas: { gte: new Date() } }] }, select: { id: true, jurusanIds: true } });
  if (!l || (l.jurusanIds.length && (!saya.majorId || !l.jurusanIds.includes(saya.majorId)))) return Response.json({ error: "Lowongan tidak tersedia." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const catatan = String(b.catatan ?? "").trim().slice(0, 1000) || null;
  await prisma.minatLowongan.upsert({
    where: { lowonganId_studentId: { lowonganId: id, studentId: saya.id } },
    create: { lowonganId: id, studentId: saya.id, catatan },
    update: { catatan },
  });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["STUDENT"]);
  const saya = await pembacaLowongan(session);
  if (!saya) return Response.json({ error: "Khusus siswa kelas XII." }, { status: 403 });
  const { id } = await params;
  await prisma.minatLowongan.deleteMany({ where: { lowonganId: id, studentId: saya.id, status: "BERMINAT" } });
  return Response.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaBkk(session))) return Response.json({ error: "Khusus pengelola BKK." }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const status = STATUS_MINAT[String(b.status)] ? String(b.status) : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  const m = await prisma.minatLowongan.update({
    where: { lowonganId_studentId: { lowonganId: id, studentId: String(b.studentId ?? "") } },
    data: { status }, include: { lowongan: { select: { judul: true, perusahaan: true } } },
  }).catch(() => null);
  if (!m) return Response.json({ error: "Data minat tidak ditemukan." }, { status: 404 });
  kirimLatar(async () => {
    const s = await prisma.student.findUnique({ where: { id: m.studentId }, select: { userId: true } });
    if (!s) return;
    await kirimNotifikasi({
      userIds: [s.userId], jenis: "PENGUMUMAN", kunci: `minat-lowongan:${m.id}:${status}`,
      judul: `${m.lowongan.judul} — ${m.lowongan.perusahaan}`, isi: `Status lamaranmu: ${STATUS_MINAT[status]}.`, url: "/dashboard/student/lowongan", tag: `lowongan-${id}`,
    });
  });
  return Response.json({ ok: true });
}
