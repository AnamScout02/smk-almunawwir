import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    const { name } = await params;
    const body = await req.json();
    const { rateLimit, sharedUsers, addressPool, sessionTimeout, idleTimeout } = body;

    try {
      await withMikrotik(async (conn) => {
        const existing = await conn.write("/ip/hotspot/user/profile/print", [`?name=${decodeURIComponent(name)}`]);
        if (!existing[0]) throw new Error("NOT_FOUND");
        const params: string[] = [`=.id=${existing[0][".id"]}`, `=rate-limit=${rateLimit ?? ""}`];
        if (sharedUsers) params.push(`=shared-users=${sharedUsers}`);
        if (addressPool !== undefined) params.push(`=address-pool=${addressPool}`);
        if (sessionTimeout) params.push(`=session-timeout=${sessionTimeout}`);
        if (idleTimeout !== undefined) params.push(`=idle-timeout=${idleTimeout || "none"}`);
        await conn.write("/ip/hotspot/user/profile/set", params);
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan hotspot-profiles PUT]", e);
      return NextResponse.json({ error: "Gagal mengubah profil" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    const { name } = await params;

    try {
      await withMikrotik(async (conn) => {
        const existing = await conn.write("/ip/hotspot/user/profile/print", [`?name=${decodeURIComponent(name)}`]);
        if (!existing[0]) throw new Error("NOT_FOUND");
        await conn.write("/ip/hotspot/user/profile/remove", [`=.id=${existing[0][".id"]}`]);
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan hotspot-profiles DELETE]", e);
      return NextResponse.json({ error: "Gagal menghapus profil (mungkin masih dipakai user)" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
