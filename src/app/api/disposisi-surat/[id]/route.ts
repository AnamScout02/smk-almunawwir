import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { sebutanSaya } from "@/lib/surat-berkas";

export const dynamic = "force-dynamic";

/** Penerima disposisi melaporkan tindak lanjutnya (Sedang diproses / Selesai). Hanya orang yang memang DITUJU. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { id } = await params;
    const d = await prisma.disposisi.findFirst({ where: { id, tujuan: { hasSome: await sebutanSaya(session) } }, select: { id: true, tindakLanjut: true } });
    if (!d) return Response.json({ error: "Disposisi ini tidak ditujukan kepada Anda." }, { status: 404 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const status = b.status === "SELESAI" || b.status === "DIPROSES" ? b.status : "";
    const catatan = typeof b.tindakLanjut === "string" ? b.tindakLanjut.trim().slice(0, 1000) : "";
    if (!status) return Response.json({ error: "Pilih Sedang diproses atau Selesai." }, { status: 400 });
    if (status === "SELESAI" && catatan.length < 3) return Response.json({ error: "Tulis apa yang sudah dilakukan." }, { status: 400 });
    // Beberapa orang bisa dituju satu disposisi: catatan disambung bernama, tidak saling menimpa.
    const baris = catatan ? `${session.name}: ${catatan}` : "";
    await prisma.disposisi.update({ where: { id }, data: { status, selesaiAt: status === "SELESAI" ? new Date() : null, tindakLanjut: [d.tindakLanjut, baris].filter(Boolean).join("\n").slice(0, 4000) || null } });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan tindak lanjut." }, { status: 500 }); }
}
