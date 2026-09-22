import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { peranBk } from "@/lib/bk-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

/** BK/Kesiswaan/Admin menandai dibaca/ditindaklanjuti dan menulis tanggapan (terlihat pengirim yang tidak anonim). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const p = await peranBk(session);
  if (!p.bk) return Response.json({ error: "Khusus BK/Kesiswaan." }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({})) as { status?: string; tanggapan?: string };
  const data: Record<string, string | null> = {};
  if (b.status && ["BARU", "DIBACA", "DITINDAKLANJUTI"].includes(b.status)) data.status = b.status;
  if (typeof b.tanggapan === "string") data.tanggapan = b.tanggapan.trim().slice(0, 2000) || null;
  await prisma.aspirasiSiswa.update({ where: { id }, data });
  segarkanAntrean();
  return Response.json({ ok: true });
}
