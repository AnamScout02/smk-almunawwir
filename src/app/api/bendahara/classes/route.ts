import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Daftar kelas ringan (id/nama/tingkat) khusus dropdown filter & "Generate Massal" modul
 * Bendahara. SENGAJA endpoint sendiri (bukan reuse /api/admin/classes) — endpoint itu punya
 * daftar exception jabatan sendiri yang sensitif (riwayat bug keamanan 2026-08-10), Bendahara
 * belum termasuk di situ dan menambahkannya berarti menyentuh file yang sudah terbukti rawan;
 * lebih aman punya endpoint kecil sendiri yang di-guard assertBendahara langsung. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const classes = await prisma.class.findMany({
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });
    return Response.json(classes);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal memuat kelas" }, { status: 500 });
  }
}
