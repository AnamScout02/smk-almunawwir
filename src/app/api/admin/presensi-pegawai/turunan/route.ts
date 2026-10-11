import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";
import { isiPulangPerkiraan, turunkanPresensi } from "@/lib/presensi-turunan";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";
const sah = (t: unknown): t is string => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t);

/** Jalankan presensi turunan & jam pulang perkiraan untuk satu rentang (maks 150 hari) — dipakai untuk mengisi hari-hari
 *  SEBELUM penjadwal otomatis ada. Aturannya di src/lib/presensi-turunan.ts: hanya mengisi hari yang belum punya catatan. */
export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json().catch(() => ({})) as { dari?: string; sampai?: string };
    if (!sah(b.dari) || !sah(b.sampai) || b.sampai < b.dari) return Response.json({ error: "Rentang tanggal tidak valid." }, { status: 400 });
    if ((Date.parse(b.sampai) - Date.parse(b.dari)) / 86400000 > 150) return Response.json({ error: "Rentang paling panjang 150 hari." }, { status: 400 });
    const t = await turunkanPresensi(b.dari, b.sampai);
    const pulang = await isiPulangPerkiraan(b.dari, b.sampai);
    await logActivity(session, { action: "CREATE", entity: "StaffAttendance", description: `Presensi turunan ${b.dari}–${b.sampai}: ${t.dibuat} catatan dibuat, ${t.dinaikkan} dikuatkan, ${t.dicabut} dicabut, ${pulang} jam pulang perkiraan` }).catch(() => null);
    return Response.json({ ok: true, ...t, pulang });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menjalankan presensi turunan." }, { status: 500 });
  }
}
