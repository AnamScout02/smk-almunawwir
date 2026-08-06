import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { ChangeMap } from "@/lib/profile-edit-fields";
import { normalizeBukuIndukText, toProperCase, toProperCaseName } from "@/lib/text";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const body = await req.json() as { action: "APPROVE" | "REJECT"; note?: string };

    const request = await prisma.profileEditRequest.findUnique({
      where: { id },
      include: { student: { select: { id: true, bukuIndukData: true } } },
    });
    if (!request) return Response.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (request.status !== "PENDING") return Response.json({ error: "Pengajuan ini sudah diproses" }, { status: 409 });

    if (body.action === "REJECT") {
      await prisma.profileEditRequest.update({
        where: { id },
        data: { status: "REJECTED", reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name },
      });
      return Response.json({ success: true });
    }

    const changes = request.changes as unknown as ChangeMap;
    const topData: Record<string, unknown> = {};
    const bukuUpdates: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(changes)) {
      const [scope, field] = key.split(":");
      if (scope === "top") {
        let v = field === "birthDate" && entry.new ? new Date(entry.new as string) : (entry.new || null);
        if (typeof v === "string" && v.trim()) {
          if (field === "parentName") v = toProperCaseName(v);
          else if (field === "previousSchool") v = toProperCase(v);
        }
        topData[field] = v;
      } else if (scope === "buku") {
        bukuUpdates[field] = entry.new;
      }
    }

    const currentBuku = (request.student.bukuIndukData as Record<string, unknown>) ?? {};
    const mergedBuku = normalizeBukuIndukText({ ...currentBuku, ...bukuUpdates });

    await prisma.$transaction([
      prisma.student.update({
        where: { id: request.student.id },
        data: { ...topData, bukuIndukData: mergedBuku as Prisma.InputJsonValue },
      }),
      prisma.profileEditRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name },
      }),
    ]);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal memproses pengajuan" }, { status: 500 });
  }
}
