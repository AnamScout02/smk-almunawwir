import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPengelolaOsis, statusEfektif } from "@/lib/osis-guard";

export const dynamic = "force-dynamic";

/** Daftar & buat pemilihan OSIS (pengelola). */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPengelolaOsis(session);
    const daftar = await prisma.pemilihanOsis.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { calon: true, pemilih: true } } },
    });
    return Response.json(daftar.map(p => ({ ...p, statusEfektif: statusEfektif(p) })));
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Pembina OSIS, Kesiswaan, dan Admin." }, { status: 403 });
    return Response.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertPengelolaOsis(session);
    const b = await req.json().catch(() => ({})) as { judul?: string; mulai?: string; selesai?: string };
    const judul = (b.judul ?? "").trim().slice(0, 150);
    const mulai = new Date(b.mulai ?? ""), selesai = new Date(b.selesai ?? "");
    if (judul.length < 5 || isNaN(mulai.getTime()) || isNaN(selesai.getTime()) || selesai <= mulai) {
      return Response.json({ error: "Isi judul dan rentang waktu pemilihan yang benar." }, { status: 400 });
    }
    const p = await prisma.pemilihanOsis.create({ data: { judul, mulai, selesai, dibuatOleh: session.name } });
    return Response.json({ id: p.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Pembina OSIS, Kesiswaan, dan Admin." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
