import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    try {
      const bindings = await withMikrotik((conn) => conn.write("/ip/hotspot/ip-binding/print"));
      return NextResponse.json(bindings);
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan ip-bindings GET]", e);
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

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    const body = await req.json();
    const { macAddress, address, type, comment } = body;
    if (!macAddress) {
      return NextResponse.json({ error: "MAC address wajib diisi" }, { status: 400 });
    }

    const params = [`=mac-address=${macAddress}`, `=type=${type || "bypassed"}`];
    if (address) params.push(`=address=${address}`);
    if (comment) params.push(`=comment=${comment}`);

    try {
      await withMikrotik((conn) => conn.write("/ip/hotspot/ip-binding/add", params));
      return NextResponse.json({ success: true }, { status: 201 });
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan ip-bindings POST]", e);
      return NextResponse.json({ error: "Gagal menambah IP binding" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
