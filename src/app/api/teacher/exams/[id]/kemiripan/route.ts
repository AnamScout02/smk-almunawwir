import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { cariKemiripan } from "@/lib/kemiripan-ujian";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Pasangan pengerjaan yang pola salahnya mencurigakan — untuk DIPERIKSA pengawas, bukan tuduhan. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    return Response.json(await cariKemiripan(id));
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
