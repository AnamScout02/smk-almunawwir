import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    const { searchParams } = new URL(req.url);
    const only = searchParams.get("interfaces");

    try {
      const traffic = await withMikrotik(async (conn) => {
        let names = only;
        if (!names) {
          const interfaces = await conn.write("/interface/print");
          names = interfaces
            .filter((i) => i.disabled === "false")
            .map((i) => i.name)
            .join(",");
        }
        if (!names) return [];
        return conn.write("/interface/monitor-traffic", [`=interface=${names}`, "=once="]);
      });
      return NextResponse.json(traffic);
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan traffic]", e);
      return NextResponse.json({ error: "Gagal terhubung ke Mikrotik" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
