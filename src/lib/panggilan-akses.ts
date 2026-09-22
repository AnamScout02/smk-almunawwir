import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";

/** Akses panggilan orang tua: Admin & Kesiswaan/BK = kelola semua; wali kelas = lihat kelas walinya. */
export async function aksesPanggilan(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return { kelola: true, kelas: null as string[] | null };
  const jabatan = await getJabatanNames(session.email);
  if (KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j))) return { kelola: true, kelas: null as string[] | null };
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } });
  const kelas = t?.homeroomOf.map(c => c.id) ?? [];
  return kelas.length ? { kelola: false, kelas } : null;
}
