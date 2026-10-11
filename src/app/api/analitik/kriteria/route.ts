import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Batas kenaikan kelas untuk Proyeksi Kenaikan — pimpinan (Kepala Sekolah, Kurikulum, Penjamin Mutu) & Admin. */
export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await bolehPantauGuru(session))) return Response.json({ error: "Khusus pimpinan sekolah." }, { status: 403 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const k = { minHadir: Math.round(Number(b.minHadir)), maksAlpha: Math.round(Number(b.maksAlpha)), maksDibawahKkm: Math.round(Number(b.maksDibawahKkm)) };
  if (!(k.minHadir >= 50 && k.minHadir <= 100) || !(k.maksAlpha >= 0 && k.maksAlpha <= 100) || !(k.maksDibawahKkm >= 0 && k.maksDibawahKkm <= 20)) return Response.json({ error: "Kehadiran 50–100%, alpha 0–100, mapel 0–20." }, { status: 400 });
  await prisma.siteSetting.upsert({ where: { key: "akademik.kriteriaNaik" }, create: { key: "akademik.kriteriaNaik", value: JSON.stringify(k) }, update: { value: JSON.stringify(k) } });
  await logActivity(session, { action: "UPDATE", entity: "SiteSetting", description: `Batas kenaikan kelas: hadir ${k.minHadir}%, alpha ${k.maksAlpha}, mapel < KKM ${k.maksDibawahKkm}` }).catch(() => null);
  return Response.json({ ok: true });
}
