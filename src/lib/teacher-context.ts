import "server-only";
import { prisma } from "@/lib/prisma";

/** Resolusi "teacher context" untuk fitur yang secara teknis butuh teacherId (Quiz/Exam/QuestionBankItem
 * dsb), tapi harus tetap bisa dipakai ADMIN/TAS meski mereka tidak punya record Teacher sendiri.
 * - TEACHER: pakai teacher record miliknya sendiri (email cocok).
 * - ADMIN/TAS: pakai teacher yang benar-benar mengampu classId+subject tsb (dari TeachingAssignment),
 *   supaya data tetap konsisten dengan penugasan mengajar yang sudah ada — admin bisa kelola ujian/bank
 *   soal untuk mapel manapun tanpa perlu logic baru khusus admin di setiap tabel.
 */
export async function resolveTeacherId(
  session: { role: string; email: string },
  opts: { classId?: string; subject: string }
): Promise<string | null> {
  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    return teacher?.id ?? null;
  }

  const assignment = await prisma.teachingAssignment.findFirst({
    where: { ...(opts.classId ? { classId: opts.classId } : {}), subject: { name: opts.subject } },
    select: { teacherId: true },
  });
  return assignment?.teacherId ?? null;
}
