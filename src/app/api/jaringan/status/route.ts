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
      const data = await withMikrotik(async (conn) => {
        const [identity, resource, interfaces, health] = await Promise.all([
          conn.write("/system/identity/print"),
          conn.write("/system/resource/print"),
          conn.write("/interface/print"),
          conn.write("/system/health/print").catch(() => []),
        ]);
        return { identity: identity[0], resource: resource[0], interfaces, health };
      });
      return NextResponse.json(data);
    } catch (e) {
      console.error("[jaringan status]", e);
      return NextResponse.json({ error: "Gagal terhubung ke Mikrotik" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
