import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";

/** Daftar jenis pelanggaran (Lampiran I Tata Tertib) — GET dibuka utk SEMUA role login (ADMIN,
 * TEACHER, TAS, STUDENT), ini murni tabel referensi publik sekolah (bukan data pribadi siapa
 * pun), sesuai permintaan BK: "bisa diakses oleh semua warga sekolah termasuk guru". Kelola
 * (tambah/ubah) tetap dibatasi Admin/Wakasek Kesiswaan/Guru BK. */
export async function GET() {
  try {
    await verifyRole(["ADMIN", "TEACHER", "TAS", "STUDENT"]);
    const types = await prisma.studentViolationType.findMany({ orderBy: [{ order: "asc" }] });
    return Response.json(types);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { category, name, pointsMin, pointsMax, piketAllowed } = await req.json();
    if (!category?.trim() || !name?.trim() || typeof pointsMin !== "number" || typeof pointsMax !== "number") {
      return Response.json({ error: "Kategori, nama, dan rentang poin wajib diisi" }, { status: 400 });
    }
    if (pointsMin < 0 || pointsMax < pointsMin) {
      return Response.json({ error: "Rentang poin tidak valid" }, { status: 400 });
    }
    const max = await prisma.studentViolationType.aggregate({ _max: { order: true } });
    const type = await prisma.studentViolationType.create({
      data: {
        category: category.trim(), name: name.trim(), pointsMin, pointsMax,
        piketAllowed: !!piketAllowed, order: (max._max.order ?? 0) + 1,
      },
    });
    return Response.json(type, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menambah jenis pelanggaran" }, { status: 500 });
  }
}
