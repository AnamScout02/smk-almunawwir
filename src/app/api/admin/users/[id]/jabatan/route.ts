import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";

/**
 * Jabatan STAF (role TAS/ADMIN). Padanan `/api/admin/teachers/[id]/jabatan` untuk guru.
 *
 * Dulu route ini TIDAK mencatat `logActivity` sementara padanannya untuk guru mencatat — padahal
 * ini perubahan HAK AKSES. Akibatnya nyata (29 September 2026): seorang staf mengeluh menu Tata
 * Usahanya tidak muncul, petugas yakin jabatannya sudah dicentang, dan tidak ada satu pun jejak
 * untuk memastikan apakah simpannya pernah benar-benar sampai. Jangan dilepas lagi.
 *
 * `catch` juga tidak boleh menelan penolakan `verifyTasAccess` (berupa redirect) menjadi 500
 * "Gagal menyimpan" — pesan itu menyesatkan: yang terjadi adalah tidak berwenang.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id: userId } = await params;
    const { jabatanIds } = await req.json();
    if (!Array.isArray(jabatanIds)) {
      return Response.json({ error: "Data jabatan tidak valid." }, { status: 400 });
    }

    const sebelum = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, staffJabatan: { select: { jabatan: { select: { name: true } } } } },
    });
    if (!sebelum) return Response.json({ error: "Akun tidak ditemukan." }, { status: 404 });

    // Jabatan yang dikirim harus benar-benar ada — id ngawur dulu membuat createMany gagal dan
    // SELURUH simpan balik jadi 500 tanpa keterangan apa yang salah.
    const sah = await prisma.jabatan.findMany({ where: { id: { in: jabatanIds } }, select: { id: true, name: true } });
    if (sah.length !== jabatanIds.length) {
      return Response.json({ error: "Ada jabatan yang tidak dikenali — muat ulang halaman lalu coba lagi." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.staffJabatan.deleteMany({ where: { userId } });
      if (sah.length > 0) {
        await tx.staffJabatan.createMany({ data: sah.map(j => ({ userId, jabatanId: j.id })) });
      }
    });

    const namaSebelum = sebelum.staffJabatan.map(j => j.jabatan.name);
    await logActivity(session, {
      action: "UPDATE_JABATAN", entity: "User", entityId: userId,
      description: `${session.name} mengubah jabatan "${sebelum.name}" dari [${namaSebelum.join(", ") || "—"}] menjadi [${sah.map(j => j.name).join(", ") || "—"}]`,
      metadata: { before: namaSebelum, after: sah.map(j => j.name) },
    });

    return Response.json({ ok: true, jabatan: sah.map(j => j.name) });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[users jabatan PUT]", e);
    return Response.json({ error: "Gagal menyimpan jabatan." }, { status: 500 });
  }
}
