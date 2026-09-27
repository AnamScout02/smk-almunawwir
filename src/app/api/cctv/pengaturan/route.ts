import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertCctv } from "@/lib/cctv-guard";
import { KUNCI, pengaturanCctv, enkripsiSandi } from "@/lib/cctv";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Pengaturan DVR. Sandi TIDAK PERNAH dikembalikan ke browser — hanya penanda `adaSandi`. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertCctv(session);
    const { host, pengguna, adaSandi, kanal, namaKanal } = await pengaturanCctv();
    return Response.json({ host, pengguna, adaSandi, kanal, namaKanal, bolehAtur: session.role !== "TEACHER" });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return Response.json({ error: "Tidak berhak melihat CCTV." }, { status: 403 });
    }
    return Response.json({ error: "Gagal memuat pengaturan." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS"]);
    const b = await req.json().catch(() => ({})) as { host?: string; pengguna?: string; sandi?: string; kanal?: string; namaKanal?: string };

    const simpan = (key: string, value: string) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });

    if (b.host !== undefined) await simpan(KUNCI.host, b.host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, ""));
    if (b.pengguna !== undefined) await simpan(KUNCI.pengguna, b.pengguna.trim());
    // Sandi kosong = jangan diubah (supaya form tidak menghapus sandi hanya karena kolomnya dibiarkan kosong).
    if (b.sandi) await simpan(KUNCI.sandi, enkripsiSandi(b.sandi));
    if (b.kanal !== undefined) await simpan(KUNCI.kanal, String(Math.max(0, Math.min(64, Number(b.kanal) || 0))));
    if (b.namaKanal !== undefined) await simpan(KUNCI.namaKanal, b.namaKanal.trim());

    await logActivity(session, {
      action: "ATUR_CCTV", entity: "SiteSetting", entityId: KUNCI.host,
      description: "Mengubah pengaturan CCTV" + (b.sandi ? " (sandi DVR diperbarui)" : ""),
    });
    const { host, pengguna, adaSandi, kanal, namaKanal } = await pengaturanCctv();
    return Response.json({ ok: true, host, pengguna, adaSandi, kanal, namaKanal });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
