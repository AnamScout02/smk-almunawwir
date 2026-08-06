import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    try {
      const [users, active] = await withMikrotik((conn) =>
        Promise.all([
          conn.write("/ip/hotspot/user/print"),
          conn.write("/ip/hotspot/active/print"),
        ])
      );
      return NextResponse.json({ users, active });
    } catch (e) {
      console.error("[jaringan hotspot-users GET]", e);
      return NextResponse.json({ error: "Gagal terhubung ke Mikrotik" }, { status: 502 });
    }
  } catch (e) {
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
    const { name, password, profile, comment } = body;
    if (!name || !password) {
      return NextResponse.json({ error: "Nama dan password wajib diisi" }, { status: 400 });
    }

    const params = [`=name=${name}`, `=password=${password}`];
    if (profile) params.push(`=profile=${profile}`);
    if (comment) params.push(`=comment=${comment}`);

    try {
      await withMikrotik((conn) => conn.write("/ip/hotspot/user/add", params));
      return NextResponse.json({ success: true }, { status: 201 });
    } catch (e) {
      console.error("[jaringan hotspot-users POST]", e);
      return NextResponse.json({ error: "Gagal menambah user hotspot (nama mungkin sudah dipakai)" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
