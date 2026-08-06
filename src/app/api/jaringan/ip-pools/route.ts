import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    try {
      const pools = await withMikrotik((conn) => conn.write("/ip/pool/print"));
      return NextResponse.json(pools);
    } catch (e) {
      console.error("[jaringan ip-pools]", e);
      return NextResponse.json({ error: "Gagal terhubung ke Mikrotik" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
