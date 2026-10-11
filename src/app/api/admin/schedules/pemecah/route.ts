import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { getSettings } from "@/lib/site-settings";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { keadaanJadwal, periksaUsulan, susunUsulan, terapkanUsulan } from "@/lib/pemecah-jadwal-server";

export const dynamic = "force-dynamic";
const tolak = (e: unknown) => { lemparBilaPengalihan(e); return Response.json({ error: e instanceof Error && e.message !== "FORBIDDEN" ? e.message : "Khusus Wakil Kepala Kurikulum." }, { status: e instanceof Error && e.message !== "FORBIDDEN" ? 409 : 403 }); };

/** PEMECAH JADWAL — keadaan jadwal sekarang: jam yang belum terjadwal dan bentrok guru yang tidak diizinkan. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const [k, s] = await Promise.all([keadaanJadwal(), getSettings(["schedule.locked"])]);
    return Response.json({ ...k, terkunci: s["schedule.locked"] === "1" });
  } catch (e) { return tolak(e); }
}

/** `{aksi: "usul", isiKurang, bentrok}` → daftar langkah untuk DITINJAU (tidak menulis). `{aksi: "terapkan", langkah}` →
 *  diperiksa ulang di server lalu ditulis; ditolak bila jadwal dikunci. */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const b = await req.json().catch(() => ({})) as { aksi?: string; isiKurang?: boolean; bentrok?: unknown; tugasId?: string; langkah?: unknown };
    if (b.aksi === "terapkan") {
      if ((await getSettings(["schedule.locked"]))["schedule.locked"] === "1") return Response.json({ error: "Jadwal sedang dikunci — buka kuncinya dulu di halaman Jadwal Pelajaran." }, { status: 423 });
      const langkah = (Array.isArray(b.langkah) ? b.langkah : []) as Parameters<typeof terapkanUsulan>[0];
      const salah = await periksaUsulan(langkah);
      if (salah) return Response.json({ error: salah }, { status: 409 });
      const h = await terapkanUsulan(langkah);
      await logActivity(session, { action: "UPDATE", entity: "Schedule", description: `Menerapkan usulan Pemecah Jadwal: ${h.dibuat} jam baru, ${h.diubah} jam dipindah` }).catch(() => null);
      return Response.json({ ok: true, ...h });
    }
    const bentrok = b.bentrok === "semua" ? "semua" as const : Array.isArray(b.bentrok) ? b.bentrok.map(String).slice(0, 300) : null;
    return Response.json(await susunUsulan({ isiKurang: b.isiKurang === true, bentrok, tugasId: typeof b.tugasId === "string" ? b.tugasId : null }));
  } catch (e) { return tolak(e); }
}
