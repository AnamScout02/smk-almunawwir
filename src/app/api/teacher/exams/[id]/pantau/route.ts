import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { susunPapanPantau } from "@/lib/pantau-ujian";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Papan pantau - sekali ambil. Layar pengawas memakai versi langsung (`/pantau/stream`, SSE) dan
 * kembali ke endpoint ini (polling tiap 5 detik) kalau stream tidak bisa dipakai. Isi papan disusun
 * `susunPapanPantau` di src/lib/pantau-ujian.ts supaya kedua jalur selalu sama. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    return Response.json(await susunPapanPantau(exam));
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
