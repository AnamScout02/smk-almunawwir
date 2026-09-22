import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, jagaAttempt, tambahJejak, HEADER_PERANGKAT, type Jejak, ujianUntukKelas } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Minta izin memutar audio listening sekali. Hitungan disimpan di jejak attempt (server), jadi
 * batasnya tidak bisa diakali dengan memuat ulang halaman atau pindah browser.
 * Body: { questionId, stimulusId? } — audio di dalam WACANA dihitung per wacana (satu wacana
 * dipakai beberapa soal; kalau dihitung per soal, batasnya berlipat). Balasan: { ok, sisa } atau
 * 403 { habis: true }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const { questionId, stimulusId } = await req.json() as { questionId: string; stimulusId?: string };
    const kunci = stimulusId ? `stim:${String(stimulusId).slice(0, 40)}` : String(questionId);

    const [exam, attempt] = await Promise.all([
      prisma.exam.findFirst({ where: { id, ...ujianUntukKelas(student.classId), isPublished: true }, select: { batasPutarAudio: true } }),
      prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } }),
    ]);
    if (!exam || !attempt) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if (attempt.submittedAt) return Response.json({ ok: true, sisa: null });
    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;

    const urutan = ((attempt.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
    if (urutan.length && !urutan.includes(String(questionId))) return Response.json({ error: "Soal tidak dikenal." }, { status: 400 });

    const sudah = (Array.isArray(jaga.jejak) ? (jaga.jejak as Jejak[]) : []).filter(j => j.jenis === "PUTAR_AUDIO" && j.ket === kunci).length;
    const batas = exam.batasPutarAudio;
    if (batas > 0 && sudah >= batas) return Response.json({ error: `Audio ini sudah diputar ${batas} kali.`, habis: true, sisa: 0 }, { status: 403 });

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { lastSeenAt: new Date(), jejak: tambahJejak(jaga.jejak, { jenis: "PUTAR_AUDIO", ket: kunci }) as object },
    });
    return Response.json({ ok: true, sisa: batas > 0 ? batas - sudah - 1 : null });
  } catch {
    return Response.json({ error: "Gagal." }, { status: 500 });
  }
}
