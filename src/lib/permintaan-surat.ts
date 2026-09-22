import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/types";

/** Siswa yang boleh diajukan surat oleh pemakai yang sedang login.
 *
 * Dipusatkan di sini supaya tiap route tidak perlu menerjemahkan sendiri "siapa boleh mengajukan
 * untuk siapa" — dan supaya `studentId` dari klien TIDAK PERNAH dipercaya mentah-mentah
 * (pola IDOR-safe yang sama dengan endpoint guru, lihat CLAUDE.md gotcha #10). */
export async function siswaYangBolehDiajukan(session: SessionPayload): Promise<{ id: string; nis: string; nama: string; kelas: string | null }[]> {
  if (session.role === "STUDENT") {
    const s = await prisma.student.findFirst({
      where: { userId: session.userId },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
    });
    return s ? [{ id: s.id, nis: s.nis, nama: s.user.name, kelas: s.class?.name ?? null }] : [];
  }
  if (session.role === "PARENT") {
    const p = await prisma.parent.findUnique({
      where: { userId: session.userId },
      select: {
        children: {
          orderBy: { createdAt: "asc" },
          select: {
            student: {
              select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
            },
          },
        },
      },
    });
    return (p?.children ?? []).map(c => ({
      id: c.student.id, nis: c.student.nis, nama: c.student.user.name, kelas: c.student.class?.name ?? null,
    }));
  }
  return [];
}
