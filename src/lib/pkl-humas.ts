import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

/** HUMAS & PKL (17 Sep 2026). Akses satu PKL: Admin, staf TU, Wakil Kepala Humas, atau guru pembimbingnya. */
export const ASPEK_PKL = [
  { kunci: "disiplin", label: "Disiplin & kehadiran" },
  { kunci: "tanggungJawab", label: "Tanggung jawab" },
  { kunci: "kerjaSama", label: "Kerja sama" },
  { kunci: "inisiatif", label: "Inisiatif & kemandirian" },
  { kunci: "keterampilan", label: "Keterampilan teknis sesuai bidang" },
  { kunci: "kualitas", label: "Kualitas hasil kerja" },
  { kunci: "etika", label: "Etika & sopan santun" },
  { kunci: "k3", label: "Keselamatan & kesehatan kerja (K3)" },
] as const;
export const MASA_TAUTAN_HARI = 30;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const tokenBaru = () => randomBytes(24).toString("base64url");

export function predikatPkl(n: number) {
  return n >= 90 ? "Sangat Baik" : n >= 80 ? "Baik" : n >= 70 ? "Cukup" : "Kurang";
}

export async function aksesHumas(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  const j = await getJabatanNames(s.email);
  return j.includes("Wakil Kepala Humas") || j.some(n => TAS_JABATAN.includes(n));
}

export async function aksesPkl(s: { role: string; email: string; userId: string }, internshipId: string) {
  const pkl = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } }, teacher: { select: { userId: true } } },
  });
  if (!pkl) return null;
  if (pkl.teacher?.userId === s.userId || (await aksesHumas(s))) return pkl;
  return null;
}

/** Nomor sertifikat berurutan per tahun: 001/PKL/SMK-AM/2026. */
export async function nomorSertifikatBerikutnya(tahun: number) {
  const n = await prisma.internship.count({ where: { sertifikatNomor: { endsWith: `/PKL/SMK-AM/${tahun}` } } });
  return `${String(n + 1).padStart(3, "0")}/PKL/SMK-AM/${tahun}`;
}
