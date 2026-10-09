import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, muatPeserta, periksaDudi, sesiPkl, tanggalDari, terisiPerDudi, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";

/** Seluruh peserta PKL + pilihan DUDI (dengan kuota terisi) + guru pembimbing — satu muatan untuk layar Penempatan. */
export async function GET() {
  try {
    await sesiPkl();
    const [peserta, dudi, terisi, guru, jurusan, bukanPeserta] = await Promise.all([
      muatPeserta(),
      prisma.industryPartner.findMany({ select: { id: true, name: true, quota: true, aktif: true, jurusanIds: true, contactPerson: true, kecamatan: true, industryField: true }, orderBy: { name: "asc" } }),
      terisiPerDudi(),
      prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
      prisma.major.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
      prisma.student.groupBy({ by: ["classId"], where: { studentStatus: "AKTIF", internship: null, class: { grade: { in: [11, 12] } } }, _count: { _all: true } }),
    ]);
    return Response.json({
      peserta,
      dudi: dudi.map(d => ({ id: d.id, nama: d.name, kuota: d.quota, terisi: terisi.get(d.id) ?? 0, aktif: d.aktif, jurusanIds: d.jurusanIds, kontak: d.contactPerson, kecamatan: d.kecamatan, bidang: d.industryField })),
      guru: guru.map(g => ({ id: g.id, nama: g.user.name })),
      jurusan,
      belumPeserta: bukanPeserta.reduce((a, x) => a + x._count._all, 0),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** PENEMPATAN MASSAL. Hanya isian yang DIKIRIM yang diubah — jadi layar yang sama dipakai untuk menempatkan ke
 *  satu DUDI, menetapkan guru pembimbing saja, atau menyeragamkan tanggal saja. Siswa yang PKL-nya sudah berjalan
 *  di DUDI lain tidak dipindah lewat sini: pindah tempat wajib lewat Mutasi supaya riwayat & alasannya tercatat. */
export async function POST(req: NextRequest) {
  try {
    const session = await sesiPkl();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ids = Array.isArray(b.studentIds) ? [...new Set(b.studentIds.filter((x): x is string => typeof x === "string"))].slice(0, 500) : [];
    if (!ids.length) return Response.json({ error: "Pilih minimal satu siswa." }, { status: 400 });
    const mitraId = typeof b.mitraId === "string" && b.mitraId ? b.mitraId : null;
    const guruId = typeof b.guruId === "string" ? b.guruId : undefined; // "" = lepaskan, undefined = tidak diubah
    const mulai = tanggalDari(b.mulai), selesai = tanggalDari(b.selesai);
    const lama = Number.isInteger(b.lamaBulan) && (b.lamaBulan as number) > 0 && (b.lamaBulan as number) <= 12 ? (b.lamaBulan as number) : null;
    const posisi = typeof b.posisi === "string" ? b.posisi.trim().slice(0, 120) : "";
    const pembimbing = typeof b.pembimbingIndustri === "string" ? b.pembimbingIndustri.trim().slice(0, 120) : "";
    if ((mulai && !selesai) || (!mulai && selesai)) return Response.json({ error: "Isi tanggal mulai dan selesai sekaligus." }, { status: 400 });
    if (mulai && selesai && selesai < mulai) return Response.json({ error: "Tanggal selesai lebih awal dari tanggal mulai." }, { status: 400 });
    if (!mitraId && guruId === undefined && !mulai && !posisi && !pembimbing) return Response.json({ error: "Tidak ada yang diubah." }, { status: 400 });

    const ada = await prisma.internship.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, mitraId: true, startDate: true, status: true, student: { select: { user: { select: { name: true } } } } } });
    const peta = new Map(ada.map(a => [a.studentId, a]));
    const baru = ids.filter(id => !peta.has(id));
    if (baru.length && (!mulai || !selesai)) return Response.json({ error: `${baru.length} siswa belum menjadi peserta PKL — isi tanggal mulai dan selesai untuk memasukkannya.` }, { status: 400 });
    if (baru.length) {
      const sah = await prisma.student.count({ where: { id: { in: baru }, studentStatus: "AKTIF" } });
      if (sah !== baru.length) return Response.json({ error: "Ada siswa yang tidak ditemukan atau tidak aktif." }, { status: 400 });
    }
    if (guruId) {
      const g = await prisma.teacher.findUnique({ where: { id: guruId }, select: { id: true } });
      if (!g) return Response.json({ error: "Guru pembimbing tidak ditemukan." }, { status: 400 });
    }

    let namaMitra = "";
    if (mitraId) {
      const kini = new Date();
      const pindah = ada.filter(a => a.mitraId && a.mitraId !== mitraId && a.status === "ONGOING" && a.startDate <= kini);
      if (pindah.length) {
        return Response.json({ error: `${pindah.length} siswa sudah menjalani PKL di tempat lain (${pindah.slice(0, 3).map(p => p.student.user.name).join(", ")}${pindah.length > 3 ? ", …" : ""}). Pindah tempat dilakukan lewat tombol Mutasi pada siswa itu, supaya riwayat dan alasannya tercatat.` }, { status: 409 });
      }
      const { mitra, peringatan } = await periksaDudi(mitraId, ids);
      if (!mitra) return Response.json({ error: "DUDI tidak ditemukan." }, { status: 404 });
      if (peringatan.length && b.paksa !== true) return Response.json({ error: "Perlu dipastikan dulu.", peringatan }, { status: 409 });
      namaMitra = mitra.name;
    }

    const ubah = {
      ...(mitraId ? { mitraId, company: namaMitra } : {}),
      ...(guruId !== undefined ? { teacherId: guruId || null } : {}),
      ...(mulai && selesai ? { startDate: mulai, endDate: selesai, lamaBulan: lama } : {}),
      ...(posisi ? { position: posisi } : {}),
      ...(pembimbing ? { supervisor: pembimbing } : {}),
    };
    await prisma.$transaction([
      prisma.internship.updateMany({ where: { studentId: { in: ids.filter(id => peta.has(id)) } }, data: ubah }),
      ...(baru.length ? [prisma.internship.createMany({
        data: baru.map(studentId => ({
          studentId, company: namaMitra || "Belum ditentukan", mitraId, position: posisi || "—", supervisor: pembimbing || "—",
          startDate: mulai!, endDate: selesai!, lamaBulan: lama, teacherId: guruId || null, status: "ONGOING",
        })),
      })] : []),
    ]);
    await logActivity(session, {
      action: "UPDATE", entity: "Internship",
      description: `Penempatan PKL massal ${ids.length} siswa${namaMitra ? ` ke ${namaMitra}` : ""}${guruId ? " + guru pembimbing" : ""}${mulai ? " + tanggal" : ""}`,
    }).catch(() => null);
    sinkronLatar(ids);
    return Response.json({ ok: true, diubah: ids.length - baru.length, dibuat: baru.length });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
