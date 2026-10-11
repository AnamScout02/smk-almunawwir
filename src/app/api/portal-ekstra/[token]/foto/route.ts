import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/pkl-humas";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { hariWibIso, tambahFotoKegiatan } from "@/lib/ekstra-server";

export const dynamic = "force-dynamic";

/** Foto bukti kegiatan HARI INI dari portal pembina (multipart: nama, file). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`portal-ekstra-foto:${getClientIpFromHeaders(req.headers)}`, 30, 600_000)) return Response.json({ error: "Terlalu banyak unggahan." }, { status: 429 });
  const { token } = await params;
  const e = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await prisma.extracurricular.findFirst({ where: { tokenPortalHash: hashToken(token) }, select: { id: true } }) : null;
  if (!e) return Response.json({ error: "Tautan tidak berlaku." }, { status: 404 });
  const fd = await req.formData().catch(() => null);
  const nama = String(fd?.get("nama") ?? "").trim().slice(0, 120);
  if (nama.length < 3) return Response.json({ error: "Tulis nama Anda dulu (minimal 3 huruf)." }, { status: 400 });
  const h = await tambahFotoKegiatan({ extracurricularId: e.id, tanggal: hariWibIso(), file: fd?.get("file"), olehNama: nama, olehPeran: "Pembina (tautan)", sumber: "PORTAL" });
  if ("galat" in h) return Response.json({ error: h.galat }, { status: 400 });
  return Response.json(h, { status: 201 });
}
