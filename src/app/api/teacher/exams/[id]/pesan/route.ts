import { NextRequest } from "next/server";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { opsiSasaranPesan, rapikanPesan } from "@/lib/pesan-ujian";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** PESAN PENGAWAS KE PESERTA — daftar pesan terkirim + pilihan sasaran (kelas, jurusan, siswa, ruang). Boleh untuk
 * siapa pun yang boleh memantau ujian ini (pembuat, pengampu, pengatur ujian) — lihat src/lib/pesan-ujian.ts. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const [pesan, opsi, soal] = await Promise.all([
      prisma.pesanUjian.findMany({ where: { examId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      opsiSasaranPesan(exam),
      prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" }, select: { id: true, pertanyaan: true } }),
    ]);
    return Response.json({
      pesan: pesan.map(p => ({
        id: p.id, teks: p.teks, sasaran: p.sasaran, kelasIds: p.kelasIds, jurusanIds: p.jurusanIds, ruangIds: p.ruangIds,
        siswaIds: p.siswaIds, questionId: p.questionId, pengirim: p.pengirimNama, waktu: p.createdAt.toISOString(),
        ditarik: p.ditarikAt ? p.ditarikAt.toISOString() : null,
      })),
      opsi,
      // Nomor URUTAN ASLI naskah — layar siswa menerjemahkannya ke nomor di urutan acaknya sendiri.
      soal: soal.map((q, i) => ({ id: q.id, nomor: i + 1, teks: q.pertanyaan.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) })),
    });
  } catch {
    return Response.json({ error: "Gagal memuat pesan." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const hasil = await rapikanPesan(exam, await req.json().catch(() => ({})));
    if ("error" in hasil) return Response.json({ error: hasil.error }, { status: 400 });
    const p = await prisma.pesanUjian.create({
      data: { examId: id, ...hasil.data, pengirimId: session.userId, pengirimNama: session.name },
    });
    await logActivity(session, {
      action: "PESAN_PESERTA_UJIAN", entity: "Exam", entityId: id,
      description: `Mengirim pesan ke peserta "${exam.title}" (${hasil.data.sasaran}): ${hasil.data.teks.slice(0, 80)}`,
    }).catch(() => {});
    kirimSinyal(id);
    return Response.json({ ok: true, id: p.id });
  } catch {
    return Response.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}

/** Tarik pesan: `?pesan=<id>` — hilang dari layar peserta pada denyut berikutnya. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const pesanId = new URL(req.url).searchParams.get("pesan") ?? "";
    const n = await prisma.pesanUjian.updateMany({ where: { id: pesanId, examId: id, ditarikAt: null }, data: { ditarikAt: new Date() } });
    if (!n.count) return Response.json({ error: "Pesan tidak ditemukan." }, { status: 404 });
    kirimSinyal(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menarik pesan." }, { status: 500 });
  }
}
