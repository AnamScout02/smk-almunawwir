import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { KUNCI_PEMELIHARAAN, bacaPemeliharaan, lupakanPemeliharaan } from "@/lib/pemeliharaan";
import { pesertaSedangUjian } from "@/lib/jaringan-ujian";

export const dynamic = "force-dynamic";

/** Mode pemeliharaan (src/lib/pemeliharaan.ts) — HANYA Superadmin: fitur ini menutup situs untuk seluruh sekolah. */
export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    lupakanPemeliharaan();
    const [keadaan, sedangUjian] = await Promise.all([bacaPemeliharaan(), pesertaSedangUjian(5).catch(() => 0)]);
    return Response.json({ ...keadaan, sedangUjian });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat." }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const s = await verifyRole(["ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const aktif = b.aktif === true;
    const pesan = String(b.pesan ?? "").slice(0, 1000);
    const sampai = String(b.sampai ?? "").slice(0, 120);
    const lama = await bacaPemeliharaan();
    const nilai: Record<string, string> = {
      [KUNCI_PEMELIHARAAN.aktif]: aktif ? "1" : "0",
      [KUNCI_PEMELIHARAAN.pesan]: pesan,
      [KUNCI_PEMELIHARAAN.sampai]: sampai,
      // Waktu mulai dicatat saat DINYALAKAN, dikosongkan saat dimatikan (menyimpan pesan tidak menggeser waktunya).
      [KUNCI_PEMELIHARAAN.mulai]: aktif ? (lama.aktif && lama.mulai ? lama.mulai : new Date().toISOString()) : "",
    };
    await prisma.$transaction(Object.entries(nilai).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })));
    lupakanPemeliharaan();
    if (lama.aktif !== aktif) {
      await logActivity(s, { action: "UPDATE", entity: "Pemeliharaan", entityId: "situs",
        description: aktif ? "Menyalakan mode pemeliharaan situs" : "Mematikan mode pemeliharaan situs" }).catch(() => {});
    }
    return Response.json({ ok: true, ...(await bacaPemeliharaan()) });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}
