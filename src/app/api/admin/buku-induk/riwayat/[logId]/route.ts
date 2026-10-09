import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { kembalikanRiwayat } from "@/lib/riwayat-induk";
import { syncParentAccountForStudent } from "@/lib/parent-account";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Mengembalikan satu catatan riwayat Buku Induk (siswa/guru) ke nilai sebelumnya — seluruhnya, atau hanya `jalur` yang dipilih.
 *  Hanya pemegang akses Buku Induk PENUH (Admin, TU, Operator Sekolah); wali kelas hanya membaca. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  try {
    const session = await verifyBukuIndukFullAccess();
    const { logId } = await params;
    const b = await req.json().catch(() => ({})) as { jalur?: unknown };
    const pilih = Array.isArray(b.jalur) ? b.jalur.filter((x): x is string => typeof x === "string").slice(0, 200) : undefined;
    const h = await kembalikanRiwayat(session, logId, pilih);
    if ("error" in h) return Response.json({ error: h.error }, { status: h.status });
    if (h.jenis === "SISWA") {
      const s = await prisma.student.findUnique({ where: { id: h.id }, select: { parentPhone: true, parentName: true } });
      if (s) await syncParentAccountForStudent(h.id, s.parentPhone, s.parentName).catch(() => {});
    }
    return Response.json(h);
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[riwayat induk kembalikan]", e);
    return Response.json({ error: "Gagal mengembalikan data." }, { status: 500 });
  }
}
