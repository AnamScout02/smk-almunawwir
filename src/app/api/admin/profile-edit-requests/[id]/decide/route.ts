import { potretSiswa, catatRiwayatSiswa } from "@/lib/riwayat-induk";
import { bakuNamaSekolah } from "@/lib/nama-sekolah";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { ChangeMap, statusKeputusan } from "@/lib/profile-edit-fields";
import { normalizeBukuIndukText, toProperCaseName } from "@/lib/text";
import { syncParentAccountForStudent } from "@/lib/parent-account";
import type { Prisma } from "@prisma/client";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    /** `tolak` = kunci isian yang DITOLAK; sisanya diterapkan. Kosong = setujui semuanya
     *  (perilaku lama, jadi pemanggil lama tetap jalan). */
    const body = await req.json() as { action: "APPROVE" | "REJECT"; note?: string; tolak?: string[] };

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
    const tolak = new Set((body.tolak ?? []).filter(k => k in changes));
    const diterima = Object.keys(changes).filter(k => !tolak.has(k));
    if (diterima.length === 0) {
      // Semua isian ditolak → sama saja dengan menolak pengajuannya.
      await prisma.profileEditRequest.update({
        where: { id },
        data: {
          status: "REJECTED", reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name,
          changes: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, { ...v, ditolak: true }])) as object,
        },
      });
      return Response.json({ success: true, diterima: 0, ditolak: tolak.size });
    }

    const topData: Record<string, unknown> = {};
    const bukuUpdates: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(changes)) {
      if (tolak.has(key)) continue;
      const [scope, field] = key.split(":");
      if (scope === "top") {
        let v = field === "birthDate" && entry.new ? new Date(entry.new as string) : (entry.new || null);
        if (typeof v === "string" && v.trim()) {
          if (field === "parentName") v = toProperCaseName(v);
          else if (field === "previousSchool") v = bakuNamaSekolah(v);
        }
        topData[field] = v;
      } else if (scope === "buku") {
        bukuUpdates[field] = entry.new;
      }
    }

    const currentBuku = (request.student.bukuIndukData as Record<string, unknown>) ?? {};
    const mergedBuku = normalizeBukuIndukText({ ...currentBuku, ...bukuUpdates });

    const sebelumRiwayat = await potretSiswa(request.student.id);
    await prisma.$transaction([
      prisma.student.update({
        where: { id: request.student.id },
        data: { ...topData, bukuIndukData: mergedBuku as Prisma.InputJsonValue },
      }),
      prisma.profileEditRequest.update({
        where: { id },
        data: {
          status: statusKeputusan(diterima.length, tolak.size),
          reviewNote: body.note || null, reviewedAt: new Date(), reviewedBy: session.name,
          // Keputusan per isian disimpan DI DALAM `changes` supaya riwayat siswa bisa menunjukkan
          // isian mana yang ditolak, bukan cuma "ditolak sebagian".
          changes: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, tolak.has(k) ? { ...v, ditolak: true } : v]),
          ) as object,
        },
      }),
    ]);

    await catatRiwayatSiswa(session, request.student.id, sebelumRiwayat, "persetujuan pengajuan biodata siswa").catch(() => 0);

    // Kalau pengajuan mengubah No. HP/Nama Orang Tua, sinkronkan akun Orang Tua otomatis —
    // gagal-sync tidak boleh menggagalkan approval yang sudah tersimpan di atas.
    if ("parentPhone" in topData || "parentName" in topData) {
      const updated = await prisma.student.findUnique({ where: { id: request.student.id }, select: { parentPhone: true, parentName: true } });
      if (updated) await syncParentAccountForStudent(request.student.id, updated.parentPhone, updated.parentName).catch(() => {});
    }

    return Response.json({ success: true, diterima: diterima.length, ditolak: tolak.size });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memproses pengajuan" }, { status: 500 });
  }
}
