import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { pekanEfektif, rentangSemesterTA } from "@/lib/pekan-efektif";

export const dynamic = "force-dynamic";

/** PROTA/PROMES + PEKAN EFEKTIF (18 Sep 2026) — per guru, mapel, tingkat, tahun ajaran, semester.
 * Pekan efektif dihitung otomatis dari Kalender Pendidikan (hari libur & agenda). */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const teacherId = await teacherIdDariSesi(session);
  if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 403 });
  const u = new URL(req.url);
  const [tahun, tugas] = await Promise.all([
    prisma.academicYear.findMany({ select: { id: true, name: true, isActive: true }, orderBy: [{ name: "desc" }] }),
    prisma.teachingAssignment.findMany({
      where: { teacherId },
      select: { subject: { select: { name: true } }, class: { select: { grade: true } } },
    }),
  ]);
  const mapel = [...new Set(tugas.map(t => t.subject?.name).filter((x): x is string => !!x))].sort();
  const tingkatTersedia = [...new Set(tugas.map(t => t.class?.grade).filter((x): x is number => !!x))].sort();
  const tahunAjaranId = tahun.find(t => t.id === u.searchParams.get("tahunAjaranId"))?.id ?? tahun.find(t => t.isActive)?.id ?? tahun[0]?.id ?? "";
  const semester = u.searchParams.get("semester") === "GENAP" ? "GENAP" : "GANJIL";
  const subject = u.searchParams.get("subject") || mapel[0] || "";
  const tingkat = Number(u.searchParams.get("tingkat")) || tingkatTersedia[0] || 10;
  const rentang = tahunAjaranId ? await rentangSemesterTA(tahunAjaranId, semester) : null;
  const [pekan, rencana] = await Promise.all([
    rentang ? pekanEfektif(rentang.mulai, rentang.selesai) : Promise.resolve({ bulan: [], totalEfektif: 0 }),
    rentang && subject ? prisma.rencanaAjar.findUnique({ where: { teacherId_subject_tingkat_tahunAjaran_semester: { teacherId, subject, tingkat, tahunAjaran: rentang.nama, semester } } }) : Promise.resolve(null),
  ]);
  return Response.json({ tahun, tahunAjaranId, semester, subject, tingkat, mapel, tingkatTersedia, rentang, pekan, rencana });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const teacherId = await teacherIdDariSesi(session);
  if (!teacherId) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const subject = String(b.subject ?? "").trim();
  const tingkat = Math.round(Number(b.tingkat));
  const tahunAjaran = String(b.tahunAjaran ?? "").trim();
  const semester = b.semester === "GENAP" ? "GENAP" : "GANJIL";
  if (!subject || !tahunAjaran || !(tingkat >= 10 && tingkat <= 13)) return Response.json({ error: "Mapel, tingkat, dan tahun ajaran wajib dipilih." }, { status: 400 });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map((x: Record<string, unknown>) => ({
    materi: String(x.materi ?? "").trim().slice(0, 300),
    jp: Math.max(0, Math.round(Number(x.jp) || 0)),
    pekanMulai: Math.max(0, Math.round(Number(x.pekanMulai) || 0)) || null,
    pekanSelesai: Math.max(0, Math.round(Number(x.pekanSelesai) || 0)) || null,
    catatan: String(x.catatan ?? "").trim().slice(0, 300) || null,
  })).filter((x: { materi: string }) => x.materi);
  await prisma.rencanaAjar.upsert({
    where: { teacherId_subject_tingkat_tahunAjaran_semester: { teacherId, subject, tingkat, tahunAjaran, semester } },
    create: { teacherId, subject, tingkat, tahunAjaran, semester, items, catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null },
    update: { items, catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null },
  });
  return Response.json({ ok: true, jumlah: items.length });
}
