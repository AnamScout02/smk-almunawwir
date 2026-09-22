import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { PREDIKAT_EKSTRA } from "@/lib/ekstra-nilai";

export const dynamic = "force-dynamic";

async function ekskulSaya(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return await prisma.extracurricular.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const nama = await getOwnedExtracurricularNames(session.email);
  if (!nama.length) return [];
  return prisma.extracurricular.findMany({ where: { name: { in: nama } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** NILAI EKSTRAKURIKULER (pembina/koordinator) — predikat per semester, ikut tampil di rapor siswa. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const ekskul = await ekskulSaya(session);
  if (!ekskul.length) return Response.json({ error: "Anda belum menjadi pembina ekstrakurikuler." }, { status: 403 });
  const u = new URL(req.url);
  const id = ekskul.find(e => e.id === u.searchParams.get("ekskulId"))?.id ?? ekskul[0].id;
  const semester = u.searchParams.get("semester") || semesterRapor()[0];
  const [anggota, nilai] = await Promise.all([
    prisma.extracurricularMember.findMany({
      where: { extracurricularId: id, student: { studentStatus: "AKTIF" } },
      select: { id: true, role: true, sertifikatToken: true, student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: { student: { user: { name: "asc" } } },
    }),
    prisma.nilaiEkstra.findMany({ where: { extracurricularId: id, semester } }),
  ]);
  const peta = new Map(nilai.map(n => [n.studentId, n]));
  return Response.json({
    ekskul, ekskulId: id, semester, semesterPilihan: semesterRapor(), predikat: PREDIKAT_EKSTRA,
    anggota: anggota.map(a => ({
      memberId: a.id, studentId: a.student.id, nama: a.student.user.name, nis: a.student.nis, kelas: a.student.class?.name ?? "-",
      peran: a.role, bersertifikat: !!a.sertifikatToken,
      predikat: peta.get(a.student.id)?.predikat ?? "", keterangan: peta.get(a.student.id)?.keterangan ?? "",
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const ekskul = await ekskulSaya(session);
  const b = await req.json().catch(() => ({}));
  const id = ekskul.find(e => e.id === b.ekskulId)?.id;
  if (!id) return Response.json({ error: "Ekstrakurikuler ini bukan binaan Anda." }, { status: 403 });
  const semester = String(b.semester ?? "").trim();
  if (!semester) return Response.json({ error: "Semester wajib dipilih." }, { status: 400 });
  const anggota = new Set((await prisma.extracurricularMember.findMany({ where: { extracurricularId: id }, select: { studentId: true } })).map(a => a.studentId));
  const baris = (Array.isArray(b.baris) ? b.baris : []).slice(0, 300)
    .filter((x: { studentId?: string; predikat?: string }) => x.studentId && anggota.has(String(x.studentId)) && PREDIKAT_EKSTRA[String(x.predikat ?? "")]);
  await prisma.$transaction(baris.map((x: { studentId: string; predikat: string; keterangan?: string }) => prisma.nilaiEkstra.upsert({
    where: { extracurricularId_studentId_semester: { extracurricularId: id, studentId: x.studentId, semester } },
    create: { extracurricularId: id, studentId: x.studentId, semester, predikat: x.predikat, keterangan: String(x.keterangan ?? "").trim().slice(0, 300) || null, olehNama: session.name },
    update: { predikat: x.predikat, keterangan: String(x.keterangan ?? "").trim().slice(0, 300) || null, olehNama: session.name },
  })));
  return Response.json({ ok: true, jumlah: baris.length });
}
