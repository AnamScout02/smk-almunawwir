import { prisma } from "@/lib/prisma";
import { jsonBesar } from "@/lib/json-besar";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    // Kolom SECUKUPNYA untuk tabel — `include` penuh ikut membawa `bukuIndukData` (JSON besar per
    // siswa) sehingga balasan 1,3 MB dan halaman lama memuat di HP (temuan user 18 Sep 2026).
    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      select: {
        id: true, nis: true, nisn: true, gender: true, studentStatus: true,
        user: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, name: true, grade: true, major: { select: { id: true, code: true } } } },
        major: { select: { id: true, name: true, code: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    return jsonBesar(students, req);
  } catch {
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}
