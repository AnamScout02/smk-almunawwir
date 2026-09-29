import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    const { id } = await params;

    try {
      await withMikrotik((conn) => conn.write("/ppp/active/remove", [`=.id=${id}`]));
      return NextResponse.json({ success: true });
    } catch (e) {
      lemparBilaPengalihan(e);
      console.error("[jaringan pppoe-active DELETE]", e);
      return NextResponse.json({ error: "Gagal memutus sesi" }, { status: 502 });
    }
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
