import { NextRequest, NextResponse } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik } from "@/lib/mikrotik";
import { setelanRouterTampil, simpanSetelanRouter, type IsianSetelanRouter } from "@/lib/router-setelan";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Uji sambungan: satu sumber untuk tombol "Uji koneksi" maupun pengujian sesudah menyimpan,
 *  supaya pesan yang dilihat petugas selalu sama. Identitas & versi router disebut agar jelas
 *  bahwa yang terhubung memang perangkat yang dimaksud, bukan sekadar port yang terbuka. */
async function ujiSambungan(): Promise<{ ok: boolean; pesan: string; mulai: number }> {
  const mulai = Date.now();
  return withMikrotik(async conn => {
    const id = await conn.write("/system/identity/print");
    const sd = await conn.write("/system/resource/print").catch(() => []);
    const nama = id[0]?.name ?? "router";
    const versi = sd[0]?.version ? ` — RouterOS ${sd[0].version}` : "";
    return { ok: true, pesan: `Tersambung ke "${nama}"${versi}.`, mulai: Date.now() - mulai };
  }).catch((e: unknown) => ({
    ok: false,
    pesan: e instanceof Error ? e.message : "Router tidak menjawab.",
    mulai: Date.now() - mulai,
  }));
}

/** SETELAN SAMBUNGAN ROUTER (27 September 2026) — alamat, port, pengguna, sandi diisi dari halaman.
 *
 * Sandi tidak pernah dikembalikan; balasan hanya menyebut apakah sandi tersimpan. Catatan aktivitas
 * juga sengaja hanya mencatat ALAMAT & PENGGUNA, tidak pernah sandinya. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    const setelan = await setelanRouterTampil();
    /* Uji dijalankan hanya bila diminta: membuka halaman tidak boleh selalu menghubungi router,
       tetapi indikator yang tidak pernah terisi juga tidak berguna — jadi halaman memintanya
       sekali saat dibuka, dan setelah itu hanya kalau petugas menekan "Uji koneksi". */
    if (new URL(req.url).searchParams.get("uji") === "1") {
      return NextResponse.json({ ...setelan, uji: await ujiSambungan() });
    }
    return NextResponse.json(setelan);
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
    const uji = b.uji === false ? null : await ujiSambungan();
    return NextResponse.json({ ok: true, setelan: kini, uji });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan setelan router." }, { status: 500 });
  }
}
