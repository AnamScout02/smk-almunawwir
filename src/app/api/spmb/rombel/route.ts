import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { sesiKonversi } from "@/lib/spmb-konversi";
import { jkDari, urutNama } from "@/lib/bagi-rombel";

export const dynamic = "force-dynamic";

/** PEMBAGIAN ROMBEL KELAS X (7 Okt 2026). Siswa baru dari SPMB (sudah Jadi Siswa) yang BELUM punya kelas,
 *  dikelompokkan per jurusan, + kelas X yang sudah ada beserta isinya. Rencana pembagian dihitung di layar
 *  dengan `bagiRombel` (src/lib/bagi-rombel.ts) supaya panitia bisa menggeser siswa sebelum menyetujui. */
export async function GET() {
  try {
    if (!(await sesiKonversi())) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
    const dariSpmb = await prisma.admission.findMany({ where: { studentId: { not: null } }, select: { studentId: true } });
    const [siswa, jurusan, kelas] = await Promise.all([
      prisma.student.findMany({
        where: { id: { in: dariSpmb.map(a => a.studentId!) }, studentStatus: "AKTIF", classId: null },
        select: { id: true, nis: true, gender: true, previousSchool: true, majorId: true, user: { select: { name: true } } },
      }),
      prisma.major.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
      prisma.class.findMany({
        where: { grade: 10 }, orderBy: { name: "asc" },
        select: { id: true, name: true, majorId: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } },
      }),
    ]);
    const perJurusan = jurusan.map(j => ({
      id: j.id, kode: j.code, nama: j.name,
      siswa: siswa.filter(s => s.majorId === j.id)
        .map(s => ({ id: s.id, nis: s.nis, nama: s.user.name, jk: jkDari(s.gender), sekolah: s.previousSchool }))
        .sort(urutNama),
      kelas: kelas.filter(k => k.majorId === j.id).map(k => ({ id: k.id, nama: k.name, isi: k._count.students })),
    })).filter(j => j.siswa.length);
    return Response.json({ jurusan: perJurusan, tanpaJurusan: siswa.filter(s => !s.majorId).length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat" }, { status: 500 });
  }
}

/** Terapkan penempatan yang disetujui: { majorId, kelas: [{ nama, siswaIds }] }. Satu jurusan per permintaan.
 *  Kelas yang belum ada dibuat (kelas X, jurusan itu). Kelas yang MASIH berisi siswa aktif lain ditolak — itu tanda
 *  Kenaikan Kelas belum dijalankan dan angkatan baru akan bercampur dengan angkatan berjalan. */
export async function POST(req: Request) {
  try {
    const session = await sesiKonversi();
    if (!session) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const majorId = String(b?.majorId ?? "");
    const daftar = (Array.isArray(b?.kelas) ? b.kelas : []) as { nama?: unknown; siswaIds?: unknown }[];
    const major = await prisma.major.findUnique({ where: { id: majorId }, select: { id: true, code: true } });
    if (!major || !daftar.length) return Response.json({ error: "Rencana pembagian tidak lengkap." }, { status: 400 });

    const rencana = daftar.map(k => ({
      nama: String(k.nama ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
      siswaIds: [...new Set((Array.isArray(k.siswaIds) ? k.siswaIds : []).map(String))],
    })).filter(k => k.nama && k.siswaIds.length);
    if (new Set(rencana.map(k => k.nama.toUpperCase())).size !== rencana.length) return Response.json({ error: "Nama kelas tidak boleh kembar." }, { status: 400 });
    const semuaId = rencana.flatMap(k => k.siswaIds);
    if (new Set(semuaId).size !== semuaId.length) return Response.json({ error: "Ada siswa yang ditempatkan di dua kelas." }, { status: 400 });

    // Hanya siswa baru SPMB jurusan ini yang belum punya kelas — id dari browser tidak dipercaya begitu saja.
    const dariSpmb = new Set((await prisma.admission.findMany({ where: { studentId: { in: semuaId } }, select: { studentId: true } })).map(a => a.studentId));
    const sah = await prisma.student.findMany({
      where: { id: { in: semuaId.filter(id => dariSpmb.has(id)) }, majorId, classId: null, studentStatus: "AKTIF" },
      select: { id: true, bukuIndukData: true },
    }).catch(() => null);
    const sahIds = new Set((sah ?? []).map(s => s.id));
    if (sahIds.size !== semuaId.length) return Response.json({ error: "Sebagian siswa sudah punya kelas atau bukan siswa baru SPMB jurusan ini. Muat ulang halaman." }, { status: 409 });

    // Selama kelas X jurusan ini masih berisi angkatan berjalan, Kenaikan Kelas BELUM dijalankan — menempatkan
    // siswa baru di kelas X sekarang (nama apa pun) membuat mereka ikut dinaikkan ke kelas XI nanti.
    const angkatanLama = await prisma.student.count({ where: { studentStatus: "AKTIF", class: { grade: 10, majorId } } });
    if (angkatanLama > 0) {
      return Response.json({ error: `Kelas X ${major.code} masih berisi ${angkatanLama} siswa angkatan berjalan. Jalankan Kenaikan Kelas dulu — kalau tidak, siswa baru ikut dinaikkan ke kelas XI.` }, { status: 409 });
    }

    const ada = await prisma.class.findMany({
      where: { grade: 10, majorId, name: { in: rencana.map(k => k.nama), mode: "insensitive" } },
      select: { id: true, name: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } },
    });
    const penuh = ada.filter(k => k._count.students > 0);
    if (penuh.length) {
      return Response.json({
        error: `${penuh.map(k => `${k.name} (${k._count.students} siswa)`).join(", ")} masih berisi siswa angkatan berjalan. Jalankan Kenaikan Kelas dulu, atau pakai nama kelas lain.`,
      }, { status: 409 });
    }

    const data = new Map((sah ?? []).map(s => [s.id, s.bukuIndukData]));
    await prisma.$transaction(async tx => {
      for (const k of rencana) {
        const kelas = ada.find(x => x.name.toUpperCase() === k.nama.toUpperCase())
          ?? await tx.class.create({ data: { name: k.nama, grade: 10, majorId }, select: { id: true, name: true } });
        const nomorRombel = kelas.name.match(/(\d+)\s*$/)?.[1];
        for (const id of k.siswaIds) {
          // Isian "Rombel" Buku Induk ikut diperbarui (pola dataSiswaDariPendaftar: angka di belakang nama kelas).
          const lama = (data.get(id) ?? {}) as Record<string, unknown>;
          await tx.student.update({
            where: { id },
            data: { classId: kelas.id, ...(nomorRombel ? { bukuIndukData: { ...lama, rombel: nomorRombel } } : {}) },
          });
        }
      }
    }, { timeout: 60_000 });
    await logActivity(session, {
      action: "UPDATE", entity: "Class",
      description: `Pembagian rombel ${major.code}: ${rencana.map(k => `${k.nama} ${k.siswaIds.length}`).join(", ")}`,
    }).catch(() => null);
    return Response.json({ ok: true, jumlah: semuaId.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
