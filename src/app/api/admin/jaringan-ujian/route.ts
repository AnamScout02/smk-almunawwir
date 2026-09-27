import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { prisma } from "@/lib/prisma";
import { KUNCI, BAWAAN, statusJaringanUjian, pastikanAturan, sinkronModeUjian, type ModeJaringan } from "@/lib/jaringan-ujian";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MODE_SAH: ModeJaringan[] = ["MATI", "OTOMATIS", "PAKSA_AKTIF"];

const simpan = (key: string, value: string) =>
  prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);
    return Response.json(await statusJaringanUjian());
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus pengelola jaringan." }, { status: 403 });
    }
    return Response.json({ error: "Gagal membaca status." }, { status: 500 });
  }
}

/** Simpan pengaturan lalu langsung samakan keadaan router — supaya admin melihat hasilnya seketika,
 * bukan menunggu penjadwal 2 menit berikutnya. */
export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    const b = await req.json().catch(() => ({})) as { mode?: string; antarmuka?: string; host?: string; tenggang?: string };
    if (b.mode && !MODE_SAH.includes(b.mode as ModeJaringan)) {
      return Response.json({ error: "Mode tidak dikenal." }, { status: 400 });
    }
    if (b.mode) await simpan(KUNCI.mode, b.mode);
    if (b.antarmuka !== undefined) await simpan(KUNCI.antarmuka, b.antarmuka.trim() || BAWAAN[KUNCI.antarmuka]);
    if (b.host !== undefined) await simpan(KUNCI.host, b.host.trim() || BAWAAN[KUNCI.host]);
    if (b.tenggang !== undefined) await simpan(KUNCI.tenggang, String(Math.max(0, Number(b.tenggang) || 10)));

    // Susun ulang aturan di router bila daftar situs/antarmuka berubah, lalu samakan nyala/matinya.
    let dibuat = 0;
    try { dibuat = await pastikanAturan(); } catch { /* router tak terjangkau — status akan menunjukkannya */ }
    await sinkronModeUjian().catch(() => null);

    await logActivity(session, {
      action: "ATUR_JARINGAN_UJIAN", entity: "SiteSetting", entityId: KUNCI.mode,
      description: `Mengubah Mode Ujian Jaringan${b.mode ? ` → ${b.mode}` : ""}${dibuat ? ` (${dibuat} aturan baru dibuat di router)` : ""}`,
    });
    return Response.json({ ok: true, dibuat, status: await statusJaringanUjian() });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus pengelola jaringan." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
