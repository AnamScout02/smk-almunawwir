import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, daftarRuang } from "@/lib/sarpras-akses";

export const dynamic = "force-dynamic";

/** Daftar ruang untuk pemesanan. PUT (pengelola penuh): ruang tambahan di luar jadwal & ruang ujian (Aula, Masjid, Lapangan …). */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const [ruang, set] = await Promise.all([daftarRuang(), prisma.siteSetting.findUnique({ where: { key: "sarpras.ruangTambahan" } })]);
  let tambahan: string[] = [];
  try { tambahan = JSON.parse(set?.value ?? "[]"); } catch { tambahan = []; }
  const a = await aksesSarpras(session);
  return Response.json({ ruang, tambahan: a.penuh ? tambahan : undefined });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.penuh) return Response.json({ error: "Khusus pengelola Sarpras." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const tambahan = Array.isArray(b.tambahan) ? [...new Set(b.tambahan.map((x: unknown) => String(x).trim()).filter(Boolean))].slice(0, 100) : [];
  await prisma.siteSetting.upsert({ where: { key: "sarpras.ruangTambahan" }, create: { key: "sarpras.ruangTambahan", value: JSON.stringify(tambahan) }, update: { value: JSON.stringify(tambahan) } });
  return Response.json({ ok: true });
}
