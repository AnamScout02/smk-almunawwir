import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";

/** Daftar ekstrakurikuler yang boleh diabsen pembina ybs — dari jabatan "Pembina <Nama>" (lihat
 * ekstrakurikuler-guard.ts), role GURU maupun staf TAS (banyak Pembina ekskul ternyata role TAS,
 * bukan guru — kasus nyata Muhammad Abdul Rokeb/Pembina Pramuka). ADMIN lihat semua. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (session.role === "ADMIN") {
      const all = await prisma.extracurricular.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      return Response.json(all);
    }
    const names = await getOwnedExtracurricularNames(session.email);
    if (names.length === 0) return Response.json([]);
    const list = await prisma.extracurricular.findMany({ where: { name: { in: names } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return Response.json(list);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
