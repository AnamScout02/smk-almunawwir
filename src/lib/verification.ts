import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Ambil token verifikasi siswa; buat baru kalau belum ada (dipanggil saat pertama kali cetak). */
export async function getOrCreateVerificationToken(studentId: string): Promise<string> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { verificationToken: true } });
  if (student?.verificationToken) return student.verificationToken;

  const token = crypto.randomBytes(16).toString("hex");
  await prisma.student.update({ where: { id: studentId }, data: { verificationToken: token } });
  return token;
}
