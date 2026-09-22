import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";

export const dynamic = "force-dynamic";

const polos = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/** SIMPAN SOAL UJIAN KE BANK SOAL (17 Sep 2026). `{ questionIds?: string[] }` — kosong = semua soal. Soal yang teksnya sudah ada
 * di bank soal guru pembuat untuk mapel ini dilewati (tidak digandakan). Kisi-kisi & stimulus ikut disalin (CLAUDE.md #36). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const { id } = await params;
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) return Response.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { questionIds?: unknown };
  const pilih = Array.isArray(b.questionIds) ? (b.questionIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const [soal, bank] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId: id, ...(pilih.length ? { id: { in: pilih } } : {}) }, orderBy: { order: "asc" } }),
    prisma.questionBankItem.findMany({ where: { teacherId: exam.teacherId, subject: exam.subject }, select: { pertanyaan: true } }),
  ]);
  const sudah = new Set(bank.map(x => polos(x.pertanyaan)));
  const baru = soal.filter(q => { const k = polos(q.pertanyaan); if (sudah.has(k)) return false; sudah.add(k); return true; });
  if (baru.length) {
    await prisma.questionBankItem.createMany({
      data: baru.map(q => ({
        teacherId: exam.teacherId, subject: exam.subject, tipe: q.tipe, pertanyaan: q.pertanyaan, opsi: q.opsi as object,
        kunci: (q.kunci ?? undefined) as object | undefined, skor: q.skor, kd: q.kd, pembahasan: q.pembahasan,
        materi: q.materi, indikator: q.indikator, levelKognitif: q.levelKognitif, stimulusId: q.stimulusId,
      })),
    });
  }
  return Response.json({ disimpan: baru.length, dilewati: soal.length - baru.length });
}
