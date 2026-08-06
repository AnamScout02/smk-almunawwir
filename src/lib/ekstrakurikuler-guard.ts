import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";

const PEMBINA_PREFIX = "Pembina ";
const KOORDINATOR_EKSKUL = "Koordinator Ekstrakurikuler";

/** Nama ekstrakurikuler yang boleh dikelola guru — dari jabatan "Pembina X" (khusus X-nya), atau semua kalau "Koordinator Ekstrakurikuler". */
export async function getOwnedExtracurricularNames(email: string): Promise<string[]> {
  const names = await getJabatanNames(email);
  if (names.includes(KOORDINATOR_EKSKUL)) {
    const all = await prisma.extracurricular.findMany({ select: { name: true } });
    return all.map(e => e.name);
  }
  return names.filter(n => n.startsWith(PEMBINA_PREFIX)).map(n => n.slice(PEMBINA_PREFIX.length));
}

export async function assertExtracurricularAccess(
  session: { role: string; email: string },
  extracurricularName: string
): Promise<void> {
  if (session.role === "ADMIN") return;
  const owned = await getOwnedExtracurricularNames(session.email);
  if (!owned.includes(extracurricularName)) throw new Error("FORBIDDEN");
}

export async function getExtracurricularById(id: string) {
  return prisma.extracurricular.findUnique({ where: { id } });
}
