import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

const include = {
  student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true, grade: true } }, major: { select: { code: true } } } },
  academicYear: { select: { id: true, name: true } },
} as const;

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const academicYearId = new URL(req.url).searchParams.get("academicYearId");
    const rows = await prisma.promotionDecision.findMany({
      where: academicYearId ? { academicYearId } : {},
      include, orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat keputusan kenaikan kelas" }, { status: 500 });
  }
}

/** Terima SATU keputusan atau BANYAK sekaligus (`{ items: [...] }`) — input massal per kelas
 * adalah cara pakai yang sebenarnya (rapat kenaikan kelas memutuskan sekelas sekaligus, bukan
 * satu-satu). Dipakai upsert supaya menyimpan ulang kelas yang sama tidak bikin data ganda
 * (dijaga juga oleh @@unique([studentId, academicYearId]) di schema). */
export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    const items: Record<string, unknown>[] = Array.isArray(b.items) ? b.items : [b];
    if (items.length === 0) return Response.json({ error: "Tidak ada data untuk disimpan." }, { status: 400 });

    const saved = await prisma.$transaction(
      items
        .filter(it => it.studentId && it.academicYearId)
        .map(it => {
          const payload = {
            fromClass: (it.fromClass as string)?.trim() || null,
            toClass: (it.toClass as string)?.trim() || null,
            decision: (it.decision as string) || "NAIK",
            reason: (it.reason as string)?.trim() || null,
            decidedAt: it.decidedAt ? new Date(it.decidedAt as string) : new Date(),
            notes: (it.notes as string)?.trim() || null,
            inputById: session.userId,
          };
          return prisma.promotionDecision.upsert({
            where: { studentId_academicYearId: { studentId: it.studentId as string, academicYearId: it.academicYearId as string } },
            create: { studentId: it.studentId as string, academicYearId: it.academicYearId as string, ...payload },
            update: payload,
            include,
          });
        })
    );
    return Response.json(saved, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan keputusan kenaikan kelas." }, { status: 500 });
  }
}
