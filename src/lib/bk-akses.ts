import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";

/** Peran pengguna untuk fitur BK (konseling & aspirasi). */
export async function peranBk(session: { role: string; email: string; userId: string }) {
  const kosong = { anak: [] as { id: string; nama: string; kelas: string }[] };
  if (session.role === "ADMIN") return { bk: true, waliKelas: [] as string[], siswaId: null as string | null, ...kosong };
  if (session.role === "PARENT") {
    const anak = await prisma.parentStudent.findMany({
      where: { parent: { userId: session.userId } },
      select: { student: { select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    });
    return { bk: false, waliKelas: [] as string[], siswaId: null as string | null, anak: anak.map(a => ({ id: a.student.id, nama: a.student.user.name, kelas: a.student.class?.name ?? "-" })) };
  }
  if (session.role === "STUDENT") {
    const s = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
    return { bk: false, waliKelas: [] as string[], siswaId: s?.id ?? null, ...kosong };
  }
  const [jabatan, t] = await Promise.all([
    getJabatanNames(session.email),
    prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } }),
  ]);
  return { bk: KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j)), waliKelas: t?.homeroomOf.map(c => c.id) ?? [], siswaId: null as string | null, ...kosong };
}
