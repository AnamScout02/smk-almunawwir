import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, TOLERANSI_MS, simpanNilaiAttempt, jagaAttempt, tambahJejak, HEADER_PERANGKAT, ujianUntukKelas } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Kumpulkan. Jawaban sudah tersimpan lewat autosave; di sini hanya menutup dan menilai.
 * Toleransi beberapa menit setelah tenggat untuk jaringan lambat - lewat itu tetap DITERIMA
 * (jawaban yang sudah masuk tidak dibuang), hanya ditandai. Body opsional { otomatis: true }
 * kalau dikumpulkan karena waktu habis (dicatat di jejak). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { otomatis?: boolean };
    const [exam, attempt] = await Promise.all([
      prisma.exam.findFirst({ where: { id, ...ujianUntukKelas(student.classId), isPublished: true }, select: { duration: true, startTime: true, endTime: true, jadwalKelas: true, tampilkanNilai: true } }),
      prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } }),
    ]);
    if (!exam || !attempt) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if (attempt.submittedAt) return Response.json({ ok: true, sudah: true });
    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;

    const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit).getTime();
    const terlambat = Date.now() > batas + TOLERANSI_MS;
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        jejak: tambahJejak(jaga.jejak, { jenis: body.otomatis ? "KUMPUL_OTOMATIS" : "KUMPUL", ket: terlambat ? "melewati tenggat" : undefined }) as object,
      },
    });
    const h = await simpanNilaiAttempt(attempt.id);
    return Response.json({ ok: true, terlambat, nilai: exam.tampilkanNilai ? h?.nilai ?? null : null, menungguKoreksi: h?.menungguKoreksi ?? 0 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengumpulkan ujian." }, { status: 500 });
  }
}
