import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";

/** DATA KESEHATAN UKS (keputusan user 17 Sep 2026): hanya Kepala UKS, Guru BK, wali kelas siswa itu, dan orang tuanya
 * (plus Admin). Mengembalikan cakupan kelas yang boleh dibaca: "SEMUA" atau daftar classId. */
export async function cakupanUks(s: { role: string; email: string; userId: string }): Promise<"SEMUA" | string[]> {
  if (s.role === "ADMIN") return "SEMUA";
  if (s.role !== "TEACHER" && s.role !== "TAS") return [];
  const j = await getJabatanNames(s.email);
  if (j.includes("Kepala UKS") || j.includes("Guru BK")) return "SEMUA";
  if (s.role !== "TEACHER") return [];
  const k = await prisma.class.findMany({ where: { homeroom: { userId: s.userId } }, select: { id: true } });
  return k.map(x => x.id);
}

export async function riwayatUks(where: { studentId?: string; classIds?: string[] }, hari = 180) {
  const sejak = new Date(Date.now() - hari * 86400000);
  return prisma.uksVisit.findMany({
    where: {
      visitDate: { gte: sejak },
      ...(where.studentId ? { studentId: where.studentId } : {}),
      ...(where.classIds ? { student: { classId: { in: where.classIds } } } : {}),
    },
    orderBy: { visitDate: "desc" }, take: 500,
    select: {
      id: true, visitDate: true, complaint: true, treatment: true, notes: true,
      student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
      usages: { select: { quantity: true, medicine: { select: { name: true, unit: true } } } },
    },
  });
}

/** Status gizi PERKIRAAN dari IMT (kategori ambang Kemenkes) — untuk remaja idealnya memakai IMT/U; beri catatan di tampilan. */
export function hitungGizi(tinggiCm?: number | null, beratKg?: number | null) {
  if (!tinggiCm || !beratKg || tinggiCm < 80 || tinggiCm > 230 || beratKg < 15 || beratKg > 250) return { imt: null, status: null };
  const imt = Math.round((beratKg / ((tinggiCm / 100) ** 2)) * 10) / 10;
  const status = imt < 17 ? "Sangat kurus" : imt < 18.5 ? "Kurus" : imt <= 25 ? "Normal" : imt <= 27 ? "Gemuk" : "Obesitas";
  return { imt, status };
}
