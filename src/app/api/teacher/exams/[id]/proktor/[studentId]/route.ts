import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { cuplikanUjian } from "@/lib/proktor-layar";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Potret terakhir satu peserta (JPEG). Hanya pengawas yang berhak atas ujian ini; tidak pernah disinggahkan. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; studentId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id, studentId } = await params;
    if (!(await ujianDalamCakupan(session, id))) return new Response("Not found", { status: 404 });
    const c = cuplikanUjian(id).get(studentId);
    if (!c) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(c.jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return new Response("Not found", { status: 404 });
  }
}
