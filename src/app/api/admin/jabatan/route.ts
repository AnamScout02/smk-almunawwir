import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Daftar jabatan.
 *
 * BENTUK BALASAN TETAP ARRAY — endpoint ini juga dipakai halaman Guru & Pegawai, Akun Pengguna,
 * dan Program Kerja yang semuanya memanggil `Array.isArray(d) ? d : []`. Nama pemegang hanya
 * disertakan bila diminta (`?pemegang=1`) supaya tiga pemanggil lain tidak ikut menarik ratusan
 * nama yang tidak mereka butuhkan.
 *
 * `_count.teachers` DIPERTAHANKAN apa adanya (dipakai teks konfirmasi hapus), dan ditambah
 * `_count.staff` — sebelumnya halaman Jabatan hanya menghitung GURU, sehingga jabatan yang
 * dipegang staf (Kepala UKS, Tim Perpustakaan, Security) selalu tertulis "0 guru" dan
 * pembagiannya tidak pernah terlihat (temuan user 28 September 2026). */
export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const pakaiPemegang = new URL(req.url).searchParams.get("pemegang") === "1";

    const jabatan = await prisma.jabatan.findMany({
      include: {
        _count: { select: { teachers: true, staff: true } },
        ...(pakaiPemegang
          ? {
              teachers: { select: { teacher: { select: { id: true, teacherStatus: true, user: { select: { name: true } } } } } },
              staff: { select: { user: { select: { id: true, name: true, role: true } } } },
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    if (!pakaiPemegang) return Response.json(jabatan);

    type BarisGuru = { teacher: { id: string; teacherStatus: string | null; user: { name: string } } };
    type BarisStaf = { user: { id: string; name: string; role: string } };
    const hasil = jabatan.map(j => {
      const g = (j as unknown as { teachers: BarisGuru[] }).teachers ?? [];
      const s = (j as unknown as { staff: BarisStaf[] }).staff ?? [];
      return {
        id: j.id,
        name: j.name,
        _count: j._count,
        pemegang: [
          ...g.map(x => ({ id: x.teacher.id, nama: x.teacher.user.name, jenis: "guru" as const, nonaktif: x.teacher.teacherStatus !== null && x.teacher.teacherStatus !== "AKTIF" })),
          ...s.map(x => ({ id: x.user.id, nama: x.user.name, jenis: "staf" as const, nonaktif: false })),
        ].sort((a, b) => a.nama.localeCompare(b.nama)),
      };
    });
    return Response.json(hasil);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { name } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Nama jabatan wajib diisi." }, { status: 400 });
    }
    const jabatan = await prisma.jabatan.create({ data: { name: name.trim() } });
    return Response.json(jabatan);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan. Nama jabatan mungkin sudah ada." }, { status: 500 });
  }
}
