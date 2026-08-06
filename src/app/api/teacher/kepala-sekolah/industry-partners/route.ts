import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Kepala Sekolah", "Wakil Kepala Humas"]);

    const [partners, students] = await Promise.all([
      prisma.industryPartner.findMany({ orderBy: { name: "asc" } }),
      prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { internship: { select: { company: true } } } }),
    ]);

    const companyCounts = new Map<string, number>();
    for (const s of students) {
      if (!s.internship) continue;
      const key = s.internship.company.trim().toLowerCase();
      companyCounts.set(key, (companyCounts.get(key) ?? 0) + 1);
    }

    const now = Date.now();
    const rows = partners.map(p => {
      let status: "AKTIF" | "AKAN_KEDALUWARSA" | "KEDALUWARSA" | "BELUM_ADA_MOU";
      if (!p.mouEndDate) status = "BELUM_ADA_MOU";
      else {
        const diffDays = (p.mouEndDate.getTime() - now) / 86400000;
        status = diffDays < 0 ? "KEDALUWARSA" : diffDays <= 30 ? "AKAN_KEDALUWARSA" : "AKTIF";
      }
      return { ...p, status, pklCount: companyCounts.get(p.name.trim().toLowerCase()) ?? 0 };
    });

    return Response.json(rows);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah atau Wakil Kepala Humas." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
