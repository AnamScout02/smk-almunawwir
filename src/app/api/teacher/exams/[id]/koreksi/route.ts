import { prisma } from "@/lib/prisma";
import { butirBerparameter, isiButirParameter } from "@/lib/soal-parameter";
import { variabelSiswaUjian } from "@/lib/soal-parameter-server";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, simpanNilaiAttempt } from "@/lib/ujian-server";
import { butuhKoreksi, type Jawaban } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Daftar jawaban uraian/unggah yang menunggu koreksi, per siswa per soal. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const [soal, attempts] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } }),
      prisma.examAttempt.findMany({
        where: { examId: id, submittedAt: { not: null } },
        include: { student: { select: { id: true, nis: true, user: { select: { name: true } } } } },
        orderBy: { student: { user: { name: "asc" } } },
      }),
    ]);
    const manual = soal.filter(q => butuhKoreksi(q.tipe));
    // Soal berparameter: pertanyaan & jawaban acuan diisi nilai milik TIAP siswa; `templat` = versi asli untuk kepala soal.
    const berparameter = new Set(manual.filter(q => butirBerparameter(q)).map(q => q.id));
    const varSiswa = berparameter.size ? await variabelSiswaUjian(id, attempts.map(a => a.studentId)) : new Map();
    const daftar = attempts.map(a => {
      const jawaban = (a.answers as Record<string, Jawaban>) ?? {};
      const skor = (a.skorButir as Record<string, number | null>) ?? {};
      const urutan = ((a.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
      return {
        attemptId: a.id, student: a.student, score: a.score,
        butir: manual.filter(q => !urutan.length || urutan.includes(q.id)).map(q => {
          const v = berparameter.has(q.id) ? varSiswa.get(a.studentId) : undefined;
          const isi = v ? isiButirParameter(q, v) : q;
          const k = (isi.kunci ?? null) as { rubrik?: string; acuan?: string } | null;
          const asli = (q.kunci ?? null) as { rubrik?: string; acuan?: string } | null;
          return {
            questionId: q.id, nomorAsli: q.order + 1, tipe: q.tipe, pertanyaan: isi.pertanyaan, skorMaks: q.skor,
            rubrik: k?.rubrik ?? null, acuan: k?.acuan ?? null,
            templat: v ? { pertanyaan: q.pertanyaan, acuan: asli?.acuan ?? null, rubrik: asli?.rubrik ?? null } : null,
            jawaban: jawaban[q.id] ?? null, skor: typeof skor[q.id] === "number" ? skor[q.id] : null,
          };
        }),
      };
    });
    return Response.json({ daftar, jumlahButirManual: manual.length });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Simpan skor manual: { attemptId, questionId, skor } lalu hitung ulang nilai. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const body = await req.json();

    /* ---- SIMPAN BANYAK SEKALIGUS (21 September 2026) ----
     * Mengoreksi uraian satu-satu lalu menekan Simpan tiap butir memakan waktu sekali ujian bisa
     * ratusan jawaban (temuan user: "apa harus simpan 1 1?"). Bentuk `{ butir: [...] }` menyimpan
     * semuanya sekali jalan; nilai tiap peserta dihitung ULANG SEKALI saja di akhir, bukan per
     * butir, supaya tidak menghitung berulang untuk siswa yang sama. */
    if (Array.isArray(body.butir)) {
      const masuk = body.butir as { attemptId?: string; questionId?: string; skor?: unknown }[];
      const [attempts, soal] = await Promise.all([
        prisma.examAttempt.findMany({ where: { examId: id }, select: { id: true, skorButir: true } }),
        prisma.examQuestion.findMany({ where: { examId: id }, select: { id: true, skor: true } }),
      ]);
      const petaAttempt = new Map(attempts.map(a => [a.id, { ...((a.skorButir as Record<string, number | null>) ?? {}) }]));
      const maksBut = new Map(soal.map(q => [q.id, q.skor]));
      const tersentuh = new Set<string>();
      let ditolak = 0;
      for (const b of masuk) {
        const peta = b.attemptId ? petaAttempt.get(b.attemptId) : undefined;
        const maks = b.questionId ? maksBut.get(b.questionId) : undefined;
        if (!peta || maks === undefined) { ditolak++; continue; }
        peta[b.questionId!] = Math.min(maks, Math.max(0, Number(b.skor) || 0));
        tersentuh.add(b.attemptId!);
      }
      await prisma.$transaction([...tersentuh].map(aid =>
        prisma.examAttempt.update({ where: { id: aid }, data: { skorButir: petaAttempt.get(aid) as object } })));
      for (const aid of tersentuh) await simpanNilaiAttempt(aid).catch(() => null);
      return Response.json({ ok: true, tersimpan: masuk.length - ditolak, ditolak, peserta: tersentuh.size });
    }

    const { attemptId, questionId, skor } = body;
    const [a, q] = await Promise.all([
      prisma.examAttempt.findFirst({ where: { id: attemptId, examId: id } }),
      prisma.examQuestion.findFirst({ where: { id: questionId, examId: id } }),
    ]);
    if (!a || !q) return Response.json({ error: "Data tidak ditemukan" }, { status: 404 });
    const nilai = Math.min(q.skor, Math.max(0, Number(skor) || 0));
    const skorButir = { ...((a.skorButir as Record<string, number | null>) ?? {}), [questionId]: nilai };
    await prisma.examAttempt.update({ where: { id: attemptId }, data: { skorButir: skorButir as object } });
    const h = await simpanNilaiAttempt(attemptId);
    return Response.json({ ok: true, nilai: h?.nilai ?? null, menungguKoreksi: h?.menungguKoreksi ?? 0 });
  } catch {
    return Response.json({ error: "Gagal menyimpan koreksi." }, { status: 500 });
  }
}
