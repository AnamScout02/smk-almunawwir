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
      const profiles = await withMikrotik((conn) => conn.write("/ip/hotspot/user/profile/print"));
      return NextResponse.json(profiles);
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan hotspot-profiles GET]", e);
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
    const { name, rateLimit, sharedUsers, addressPool, sessionTimeout, idleTimeout } = body;
    if (!name) {
      return NextResponse.json({ error: "Nama profil wajib diisi" }, { status: 400 });
    }

    const params = [`=name=${name}`];
    if (rateLimit) params.push(`=rate-limit=${rateLimit}`);
    if (sharedUsers) params.push(`=shared-users=${sharedUsers}`);
    if (addressPool) params.push(`=address-pool=${addressPool}`);
    if (sessionTimeout) params.push(`=session-timeout=${sessionTimeout}`);
    if (idleTimeout) params.push(`=idle-timeout=${idleTimeout}`);

    try {
      await withMikrotik((conn) => conn.write("/ip/hotspot/user/profile/add", params));
      return NextResponse.json({ success: true }, { status: 201 });
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan hotspot-profiles POST]", e);
      return NextResponse.json({ error: "Gagal menambah profil (nama mungkin sudah dipakai)" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
