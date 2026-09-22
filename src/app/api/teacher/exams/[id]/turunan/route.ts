import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { buatTokenUnik, kelasPeserta, ujianDalamCakupan } from "@/lib/ujian-server";
import { petaKkm } from "@/lib/kkm";

export const dynamic = "force-dynamic";

/** UJIAN SUSULAN & REMEDIAL (17 Sep 2026). Turunan dari ujian induk: pengaturan & soal (beserta kisi-kisinya) disalin,
 * peserta dibatasi (`pesertaIds`), belum diterbitkan sampai guru memeriksanya.
 * GET  → calon peserta: susulan = siswa kelas peserta yang belum mengerjakan; remedial = nilai di bawah KKM mapel.
 * POST → { jenis, siswaIds, startTime, endTime, duration? } buat ujian turunan. Hanya pembuat ujian / pengatur ujian. */

async function calon(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, subject: true, classId: true, kelasIds: true, pesertaIds: true } });
  if (!exam) return null;
  const [siswa, attempts] = await Promise.all([
    prisma.student.findMany({
      where: { classId: { in: kelasPeserta(exam) }, studentStatus: "AKTIF", ...(exam.pesertaIds.length ? { id: { in: exam.pesertaIds } } : {}) },
      select: { id: true, nis: true, majorId: true, user: { select: { name: true } }, class: { select: { name: true, grade: true } } },
      orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
    }),
    prisma.examAttempt.findMany({ where: { examId }, select: { studentId: true, score: true, submittedAt: true } }),
  ]);
  const perSiswa = new Map(attempts.map(a => [a.studentId, a]));
  const kkmCache = new Map<string, number>();
  const susulan = [], remedial = [];
  for (const s of siswa) {
    const a = perSiswa.get(s.id);
    const dasar = { id: s.id, nis: s.nis, nama: s.user.name, kelas: s.class?.name ?? "-" };
    if (!a || !a.submittedAt) { susulan.push({ ...dasar, keterangan: a ? "belum mengumpulkan" : "belum mengerjakan" }); continue; }
    if (a.score === null) continue;
    const k = `${s.class?.grade}|${s.majorId}`;
    if (!kkmCache.has(k)) kkmCache.set(k, (await petaKkm({ grade: s.class?.grade, majorId: s.majorId })).kkmUntuk(exam.subject));
    const kkm = kkmCache.get(k)!;
    if (a.score < kkm) remedial.push({ ...dasar, nilai: a.score, kkm, keterangan: `nilai ${a.score} < KKM ${kkm}` });
  }
  return { susulan, remedial };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const { id } = await params;
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) return Response.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
  const [daftar, turunan] = await Promise.all([
    calon(id),
    prisma.exam.findMany({ where: { indukId: id }, select: { id: true, title: true, jenis: true, isPublished: true, startTime: true, pesertaIds: true, _count: { select: { attempts: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return Response.json({ ...daftar, turunan: turunan.map(t => ({ ...t, jumlahPeserta: t.pesertaIds.length, pesertaIds: undefined })) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const { id } = await params;
  const induk = await ujianDalamCakupan(session, id, { ubah: true });
  if (!induk) return Response.json({ error: "Hanya pembuat ujian yang dapat membuat susulan/remedial." }, { status: 403 });
  const b = await req.json().catch(() => null) as { jenis?: unknown; siswaIds?: unknown; startTime?: unknown; endTime?: unknown; duration?: unknown } | null;
  const jenis = b?.jenis === "SUSULAN" || b?.jenis === "REMEDIAL" ? b.jenis : null;
  if (!jenis) return Response.json({ error: "Pilih jenis: susulan atau remedial." }, { status: 400 });
  const mulai = new Date(String(b?.startTime ?? "")), tutup = new Date(String(b?.endTime ?? ""));
  if (isNaN(mulai.getTime()) || isNaN(tutup.getTime()) || tutup <= mulai) return Response.json({ error: "Jam mulai dan tutup tidak valid." }, { status: 400 });
  const durasi = Number(b?.duration ?? induk.duration);
  if (!Number.isInteger(durasi) || durasi < 5 || durasi > 600) return Response.json({ error: "Durasi 5–600 menit." }, { status: 400 });
  const diminta = Array.isArray(b?.siswaIds) ? [...new Set((b!.siswaIds as unknown[]).filter((x): x is string => typeof x === "string"))] : [];
  const daftar = await calon(id);
  const sah = new Set((jenis === "SUSULAN" ? daftar?.susulan : daftar?.remedial)?.map(s => s.id) ?? []);
  const peserta = diminta.filter(x => sah.has(x));
  if (!peserta.length) return Response.json({ error: `Pilih minimal satu siswa calon ${jenis === "SUSULAN" ? "susulan" : "remedial"}.` }, { status: 400 });

  const soal = await prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } });
  const token = await buatTokenUnik();
  const baru = await prisma.exam.create({
    data: {
      teacherId: induk.teacherId, classId: induk.classId, kelasIds: induk.kelasIds, subject: induk.subject,
      title: `${jenis === "SUSULAN" ? "Susulan" : "Remedial"} — ${induk.title}`.slice(0, 190),
      description: induk.description, token, duration: durasi, startTime: mulai, endTime: tutup, isPublished: false,
      acakSoal: induk.acakSoal, acakOpsi: induk.acakOpsi, satuSoalPerHalaman: induk.satuSoalPerHalaman,
      tampilkanNilai: induk.tampilkanNilai, batasPindahTab: induk.batasPindahTab, jumlahDikerjakan: induk.jumlahDikerjakan,
      tokenOtomatisMenit: induk.tokenOtomatisMenit, batasPutarAudio: induk.batasPutarAudio,
      izinKalkulator: induk.izinKalkulator, izinCoretan: induk.izinCoretan, kegiatanId: induk.kegiatanId,
      jenis, indukId: induk.id, pesertaIds: peserta,
      questions: {
        create: soal.map(q => ({
          tipe: q.tipe, pertanyaan: q.pertanyaan, opsi: q.opsi as object, kunci: (q.kunci ?? undefined) as object | undefined,
          skor: q.skor, kd: q.kd, pembahasan: q.pembahasan, materi: q.materi, indikator: q.indikator, levelKognitif: q.levelKognitif,
          stimulusId: q.stimulusId, order: q.order, posisiKunci: q.posisiKunci,
        })),
      },
    },
    select: { id: true, title: true },
  });
  await logActivity(session, {
    action: jenis === "SUSULAN" ? "BUAT_UJIAN_SUSULAN" : "BUAT_UJIAN_REMEDIAL", entity: "Exam", entityId: baru.id,
    description: `${baru.title}: ${peserta.length} siswa, ${soal.length} soal (induk ${induk.id})`,
  }).catch(() => {});
  return Response.json({ ok: true, id: baru.id, peserta: peserta.length }, { status: 201 });
}
