import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, TOLERANSI_MS, jagaAttempt, HEADER_PERANGKAT, ujianUntukKelas } from "@/lib/ujian-server";
import { FOLDER_LISAN, MAKS_BYTE_LISAN, ekstensiAudio, alamatLisan } from "@/lib/ujian-lisan";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Unggah rekaman JAWABAN LISAN (src/lib/ujian-lisan.ts). Multipart: questionId, file (audio). Menyimpan berkas di folder
 * rahasia, mengisi jawaban soal itu dengan alamat pemutarnya, dan menghapus rekaman lama soal yang sama. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const fd = await req.formData();
    const questionId = String(fd.get("questionId") ?? "");
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Rekaman kosong." }, { status: 400 });
    if (file.size > MAKS_BYTE_LISAN) return Response.json({ error: "Rekaman terlalu besar (maks 12 MB)." }, { status: 400 });
    const ext = ekstensiAudio(file.type);
    if (!ext) return Response.json({ error: "Jenis rekaman tidak dikenal." }, { status: 400 });

    const [exam, attempt, soal] = await Promise.all([
      prisma.exam.findFirst({ where: { id, ...ujianUntukKelas(student.classId), isPublished: true }, select: { duration: true, startTime: true, endTime: true, jadwalKelas: true } }),
      prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } }),
      prisma.examQuestion.findFirst({ where: { id: questionId, examId: id }, select: { tipe: true } }),
    ]);
    if (!exam || !attempt) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if (soal?.tipe !== "LISAN") return Response.json({ error: "Soal ini bukan soal lisan." }, { status: 400 });
    if (attempt.submittedAt) return Response.json({ error: "Ujian sudah dikumpulkan.", selesai: true }, { status: 400 });
    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;
    const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit).getTime();
    if (Date.now() > batas + TOLERANSI_MS) return Response.json({ error: "Waktu ujian sudah habis.", habis: true }, { status: 403 });
    const urutan = ((attempt.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
    if (urutan.length && !urutan.includes(questionId)) return Response.json({ error: "Soal tidak dikenal." }, { status: 400 });

    const folder = join(FOLDER_LISAN, id);
    await mkdir(folder, { recursive: true });
    const berkas = `${attempt.id}-${questionId}-${Date.now()}.${ext}`;
    await writeFile(join(folder, berkas), Buffer.from(await file.arrayBuffer()));

    // Jawaban langsung diisi di sini (bukan menunggu antrean jawab) — rekaman sebelumnya untuk soal ini dihapus.
    const answers = { ...((attempt.answers as Record<string, unknown>) ?? {}) };
    const lama = typeof answers[questionId] === "string" ? String(answers[questionId]) : "";
    const url = alamatLisan(id, berkas);
    answers[questionId] = url;
    await prisma.examAttempt.update({ where: { id: attempt.id }, data: { answers: answers as object, lastSeenAt: new Date() } });
    if (lama.startsWith(`/api/ujian/lisan/${id}/${attempt.id}-`)) await unlink(join(folder, lama.split("/").pop()!)).catch(() => {});
    return Response.json({ ok: true, url });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyimpan rekaman." }, { status: 500 });
  }
}
