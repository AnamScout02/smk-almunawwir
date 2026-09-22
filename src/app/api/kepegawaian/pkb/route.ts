import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { guruSaya, kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

/** PORTOFOLIO PKB (Pengembangan Keprofesian Berkelanjutan) — guru mengisi riwayat pelatihan/seminar/
 * diklat yang diikutinya; pengelola kepegawaian melihat & merekap semua guru (18 September 2026). */
export const JENIS_PKB: Record<string, string> = {
  PELATIHAN: "Pelatihan", SEMINAR: "Seminar/Webinar", WORKSHOP: "Workshop", DIKLAT: "Diklat",
  MGMP: "MGMP/KKG", LOMBA: "Lomba/Kompetisi", LAINNYA: "Lainnya",
};

export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const kelola = await kelolaKepegawaian(session);
  const saya = await guruSaya(session.userId);
  const pilih = new URL(req.url).searchParams.get("teacherId");
  const teacherId = kelola ? (pilih || undefined) : saya?.id;
  if (!kelola && !teacherId) return Response.json({ error: "Data kepegawaian Anda tidak ditemukan." }, { status: 403 });
  const [daftar, guru] = await Promise.all([
    prisma.pkbGuru.findMany({
      where: teacherId ? { teacherId } : {}, orderBy: { mulai: "desc" }, take: 500,
      include: { teacher: { select: { nip: true, user: { select: { name: true } } } } },
    }),
    kelola
      ? prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, nip: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } })
      : Promise.resolve([]),
  ]);
  return Response.json({
    kelola, teacherId: teacherId ?? "", saya: saya?.id ?? "", jenis: JENIS_PKB,
    guru: guru.map(g => ({ id: g.id, nama: g.user.name, nip: g.nip })),
    daftar: daftar.map(d => ({ ...d, namaGuru: d.teacher.user.name })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const kelola = await kelolaKepegawaian(session);
  const saya = await guruSaya(session.userId);
  const b = await req.json().catch(() => ({}));
  // Guru hanya boleh mengisi portofolionya sendiri; pengelola kepegawaian boleh mengisikan untuk guru lain.
  const teacherId = kelola && typeof b.teacherId === "string" && b.teacherId ? b.teacherId : saya?.id;
  if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 400 });
  const judul = String(b.judul ?? "").trim().slice(0, 250);
  const mulai = new Date(b.mulai);
  if (!judul || isNaN(mulai.getTime())) return Response.json({ error: "Nama kegiatan dan tanggal mulai wajib diisi." }, { status: 400 });
  await prisma.pkbGuru.create({
    data: {
      teacherId, judul, jenis: JENIS_PKB[String(b.jenis)] ? String(b.jenis) : "PELATIHAN",
      penyelenggara: String(b.penyelenggara ?? "").trim().slice(0, 200) || null,
      peran: String(b.peran ?? "").trim().slice(0, 50) || null,
      mulai, selesai: b.selesai ? new Date(b.selesai) : null,
      jamPelajaran: Number.isFinite(Number(b.jamPelajaran)) && Number(b.jamPelajaran) > 0 ? Math.min(9999, Math.round(Number(b.jamPelajaran))) : null,
      nomorSertifikat: String(b.nomorSertifikat ?? "").trim().slice(0, 120) || null,
      berkas: typeof b.berkas === "string" && /^[\w./-]{5,160}$/.test(b.berkas) ? b.berkas : null,
      catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null,
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
