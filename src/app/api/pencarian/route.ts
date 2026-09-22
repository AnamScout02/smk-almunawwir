import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { cariCepat } from "@/lib/pencarian-cepat";

export const dynamic = "force-dynamic";

/** GET /api/pencarian?q= — pencarian cepat lintas modul, cakupan mengikuti peran (lihat src/lib/pencarian-cepat.ts). */
export async function GET(req: Request) {
  const session = await verifySession();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hasil = await cariCepat(session, q).catch(() => []);
  return NextResponse.json({ hasil });
}
