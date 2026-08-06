import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    const { id } = await params;

    try {
      await withMikrotik((conn) => conn.write("/ip/hotspot/ip-binding/remove", [`=.id=${id}`]));
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[jaringan ip-bindings DELETE]", e);
      return NextResponse.json({ error: "Gagal menghapus IP binding" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
