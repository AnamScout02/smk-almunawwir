import { NextRequest, NextResponse } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { setelanRouterTampil, simpanSetelanRouter, type IsianSetelanRouter } from "@/lib/router-setelan";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** SETELAN SAMBUNGAN ROUTER (27 September 2026) — alamat, port, pengguna, sandi diisi dari halaman.
 *
 * Sandi tidak pernah dikembalikan; balasan hanya menyebut apakah sandi tersimpan. Catatan aktivitas
 * juga sengaja hanya mencatat ALAMAT & PENGGUNA, tidak pernah sandinya. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    return NextResponse.json(await setelanRouterTampil());
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat setelan router." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    const b = await req.json().catch(() => ({})) as IsianSetelanRouter & { uji?: boolean };
    const { galat } = await simpanSetelanRouter(b);
    if (galat) return NextResponse.json({ error: galat }, { status: 400 });

    const kini = await setelanRouterTampil();
    await logActivity(session, {
      action: "UBAH_SETELAN_ROUTER", entity: "SiteSetting",
      description: `Mengubah sambungan router → ${kini.host}:${kini.port} sebagai "${kini.user}"${b.sandi ? " (sandi diperbarui)" : ""}`,
    });

    /* Uji langsung setelah menyimpan: kalau setelan barunya salah, petugas tahu SEKARANG — bukan
     * nanti saat halaman lain melapor "Router tidak bisa dihubungi" tanpa sebab yang jelas. */
    let uji: { ok: boolean; pesan: string } | null = null;
    if (b.uji !== false) {
      uji = await withMikrotik(async conn => {
        const id = await conn.write("/system/identity/print");
        const sd = await conn.write("/system/resource/print").catch(() => []);
        return { ok: true, pesan: `Tersambung ke "${id[0]?.name ?? "router"}"${sd[0]?.version ? ` — RouterOS ${sd[0].version}` : ""}.` };
      }).catch((e: unknown) => ({ ok: false, pesan: e instanceof Error ? e.message : "Router tidak menjawab." }));
    }
    return NextResponse.json({ ok: true, setelan: kini, uji });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan setelan router." }, { status: 500 });
  }
}
