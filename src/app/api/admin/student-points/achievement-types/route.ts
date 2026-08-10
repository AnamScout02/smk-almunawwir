import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";

/** Daftar jenis prestasi (Lampiran II Tata Tertib) — GET dibuka utk semua role login, sama
 * seperti violation-types (tabel referensi publik). Kelola dibatasi Admin/Kesiswaan/BK. */
export async function GET() {
  try {
    await verifyRole(["ADMIN", "TEACHER", "TAS", "STUDENT"]);
    const types = await prisma.studentAchievementType.findMany({ orderBy: [{ order: "asc" }] });
    return Response.json(types);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { name, pointsMin, pointsMax } = await req.json();
    if (!name?.trim() || typeof pointsMin !== "number" || typeof pointsMax !== "number") {
      return Response.json({ error: "Nama dan rentang poin wajib diisi" }, { status: 400 });
    }
    if (pointsMin < 0 || pointsMax < pointsMin) {
      return Response.json({ error: "Rentang poin tidak valid" }, { status: 400 });
    }
    const max = await prisma.studentAchievementType.aggregate({ _max: { order: true } });
    const type = await prisma.studentAchievementType.create({
      data: { name: name.trim(), pointsMin, pointsMax, order: (max._max.order ?? 0) + 1 },
    });
    return Response.json(type, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menambah jenis prestasi" }, { status: 500 });
  }
}
