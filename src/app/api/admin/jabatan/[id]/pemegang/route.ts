import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { getSettings } from "@/lib/site-settings";
import { strukturPerluDiperbarui } from "@/lib/struktur-jabatan";

export const dynamic = "force-dynamic";

/**
 * Pemegang SATU jabatan — arah kebalikan dari `/api/admin/{users,teachers}/[id]/jabatan`
 * (yang mengatur "jabatan apa saja milik orang ini").
 *
 * Halaman Jabatan sebelumnya hanya BISA MELIHAT pemegang: untuk mengangkat seseorang, petugas
 * harus mencarinya lagi di Akun Pengguna / Buku Induk Guru. Itu yang membuat menu Jabatan terasa
 * dobel padahal buntu (keluhan user 29 September 2026). Katalog jabatan tetap terpisah dari data
 * orang — yang dihilangkan hanyalah jalan buntunya.
 *
 * Pemegang tersimpan di DUA tabel: guru di `TeacherJabatan` (per `Teacher.id`), staf/admin di
 * `StaffJabatan` (per `User.id`). Keduanya diganti sekaligus supaya tidak ada keadaan setengah jadi.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const [jabatan, guru, staf] = await Promise.all([
      prisma.jabatan.findUnique({
        where: { id },
        select: {
          id: true, name: true,
          teachers: { select: { teacherId: true } },
          staff: { select: { userId: true } },
        },
      }),
      prisma.teacher.findMany({
        select: { id: true, teacherStatus: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "TAS"] } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
    if (!jabatan) return NextResponse.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });

    return NextResponse.json({
      jabatan: { id: jabatan.id, name: jabatan.name },
      guruIds: jabatan.teachers.map(t => t.teacherId),
      stafIds: jabatan.staff.map(s => s.userId),
      guru: guru.map(g => ({ id: g.id, nama: g.user.name, nonaktif: (g.teacherStatus ?? "AKTIF") !== "AKTIF" })),
      staf: staf.map(s => ({ id: s.id, nama: s.name, role: s.role })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const { guruIds, stafIds } = await req.json() as { guruIds?: string[]; stafIds?: string[] };
    if (!Array.isArray(guruIds) || !Array.isArray(stafIds)) {
      return NextResponse.json({ error: "Data pemegang tidak valid." }, { status: 400 });
    }

    const jabatan = await prisma.jabatan.findUnique({
      where: { id },
      select: {
        name: true,
        teachers: { select: { teacher: { select: { user: { select: { name: true } } } } } },
        staff: { select: { user: { select: { name: true } } } },
      },
    });
    if (!jabatan) return NextResponse.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });

    // Id ngawur ditolak lebih dulu — kalau tidak, createMany gagal dan seluruh simpan balik jadi
    // 500 tanpa keterangan apa yang salah.
    const [guruSah, stafSah] = await Promise.all([
      prisma.teacher.findMany({ where: { id: { in: guruIds } }, select: { id: true, user: { select: { name: true } } } }),
      prisma.user.findMany({ where: { id: { in: stafIds }, role: { in: ["ADMIN", "TAS"] } }, select: { id: true, name: true } }),
    ]);
    if (guruSah.length !== guruIds.length || stafSah.length !== stafIds.length) {
      return NextResponse.json({ error: "Ada orang yang tidak dikenali — muat ulang halaman lalu coba lagi." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacherJabatan.deleteMany({ where: { jabatanId: id } });
      await tx.staffJabatan.deleteMany({ where: { jabatanId: id } });
      if (guruSah.length > 0) {
        await tx.teacherJabatan.createMany({ data: guruSah.map(g => ({ jabatanId: id, teacherId: g.id })) });
      }
      if (stafSah.length > 0) {
        await tx.staffJabatan.createMany({ data: stafSah.map(s => ({ jabatanId: id, userId: s.id })) });
      }
    });

    const sebelum = [...jabatan.teachers.map(t => t.teacher.user.name), ...jabatan.staff.map(s => s.user.name)];
    const sesudah = [...guruSah.map(g => g.user.name), ...stafSah.map(s => s.name)];
    await logActivity(session, {
      action: "UPDATE_JABATAN", entity: "Jabatan", entityId: id,
      description: `${session.name} mengubah pemegang jabatan "${jabatan.name}" dari [${sebelum.join(", ") || "—"}] menjadi [${sesudah.join(", ") || "—"}]`,
      metadata: { before: sebelum, after: sesudah },
    });

    /* Struktur Organisasi di situs publik adalah daftar nama TERPISAH yang diketik manual
       (SiteSetting `school.structure`) — mengganti pemegang di sini tidak memperbaruinya, dan
       situs bisa tetap menampilkan pejabat lama. Petugas DIINGATKAN, bukan ditimpa otomatis:
       nama di sana ditulis lengkap dengan gelar dan urutannya diatur sendiri. */
    let struktur: { role: string; name: string }[] = [];
    try {
      const st = await getSettings(["school.structure"]);
      struktur = strukturPerluDiperbarui(jabatan.name, sesudah, JSON.parse(st["school.structure"] || "[]"));
    } catch { struktur = []; }

    return NextResponse.json({ ok: true, pemegang: sesudah, struktur });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[jabatan pemegang PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan pemegang jabatan." }, { status: 500 });
  }
}
