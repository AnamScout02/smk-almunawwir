import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { guruSaya, JENIS_SK, kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

/** Arsip SK: pengelola melihat semua (filter ?teacherId=), guru melihat miliknya sendiri. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const kelola = await kelolaKepegawaian(session);
  const saya = await guruSaya(session.userId);
  const pilih = new URL(req.url).searchParams.get("teacherId");
  const teacherId = kelola ? (pilih || undefined) : saya?.id;
  if (!kelola && !teacherId) return Response.json({ error: "Data kepegawaian tidak ditemukan." }, { status: 403 });
  const [daftar, guru] = await Promise.all([
    prisma.arsipSk.findMany({ where: teacherId ? { teacherId } : {}, orderBy: { tanggal: "desc" }, take: 500 }),
    kelola ? prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, nip: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);
  return Response.json({
    kelola, jenis: JENIS_SK, teacherId: teacherId ?? "",
    guru: guru.map(g => ({ id: g.id, nama: g.user.name, nip: g.nip })),
    daftar,
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaKepegawaian(session))) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const tanggal = new Date(b.tanggal);
  const guru = await prisma.teacher.findUnique({ where: { id: String(b.teacherId ?? "") }, select: { id: true } });
  if (!guru) return Response.json({ error: "Pilih guru/pegawai." }, { status: 400 });
  if (!judul || isNaN(tanggal.getTime())) return Response.json({ error: "Judul dan tanggal dokumen wajib diisi." }, { status: 400 });
  await prisma.arsipSk.create({
    data: {
      teacherId: guru.id, judul, tanggal, jenis: JENIS_SK[String(b.jenis)] ? String(b.jenis) : "SK",
      nomor: String(b.nomor ?? "").trim().slice(0, 100) || null,
      berlakuSampai: b.berlakuSampai ? new Date(b.berlakuSampai) : null,
      berkas: typeof b.berkas === "string" && /^[\w.-]{5,120}$/.test(b.berkas) ? b.berkas : null,
      catatan: String(b.catatan ?? "").trim().slice(0, 500) || null,
      olehNama: session.name,
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
